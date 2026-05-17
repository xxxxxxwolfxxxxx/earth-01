import { useEffect, useRef, useState, useCallback } from 'react'

const GRID = 80
const CELL = 8
const COLORS = {
  empty: '#0a0a20',
  food: '#22c55e',
  water: '#3b82f6',
  danger: '#ef4444',
  agent: '#fbbf24',
  agentSmart: '#7c3aed',
  agentSocial: '#ec4899',
}

function createWorld() {
  const tiles = Array.from({ length: GRID * GRID }, (_, i) => {
    const x = i % GRID, y = Math.floor(i / GRID)
    const dist = Math.hypot(x - GRID / 2, y - GRID / 2)
    if (dist > GRID * 0.45) return 'empty'
    const noise = Math.random()
    if (noise < 0.15) return 'food'
    if (noise < 0.2) return 'water'
    if (noise < 0.22) return 'danger'
    return 'empty'
  })
  return tiles
}

function createAgents(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID),
    energy: 50 + Math.random() * 50,
    type: Math.random() > 0.7 ? 'smart' : Math.random() > 0.5 ? 'social' : 'basic',
    dx: 0, dy: 0,
    age: 0,
    messages: [],
  }))
}

export default function WorldCanvas() {
  const canvasRef = useRef(null)
  const worldRef = useRef(createWorld())
  const agentsRef = useRef(createAgents())
  const tickRef = useRef(0)
  const [stats, setStats] = useState({ agents: 30, tick: 0, season: 'Frühling' })
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(200)
  const [hoveredAgent, setHoveredAgent] = useState(null)

  const seasons = ['Frühling', 'Sommer', 'Herbst', 'Winter']

  const tick = useCallback(() => {
    const world = worldRef.current
    const agents = agentsRef.current
    tickRef.current++
    const t = tickRef.current
    const season = seasons[Math.floor(t / 100) % 4]

    const foodMultiplier = season === 'Sommer' ? 1.5 : season === 'Winter' ? 0.3 : 1

    if (t % 50 === 0 && Math.random() < 0.3) {
      const cx = Math.floor(Math.random() * GRID)
      const cy = Math.floor(Math.random() * GRID)
      for (let dx = -5; dx <= 5; dx++) {
        for (let dy = -5; dy <= 5; dy++) {
          const nx = cx + dx, ny = cy + dy
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && Math.hypot(dx, dy) < 5) {
            world[ny * GRID + nx] = Math.random() < 0.4 ? 'danger' : 'empty'
          }
        }
      }
    }

    if (t % 10 === 0) {
      for (let i = 0; i < 5; i++) {
        const idx = Math.floor(Math.random() * world.length)
        if (world[idx] === 'empty' && Math.random() < 0.1 * foodMultiplier) {
          world[idx] = 'food'
        }
      }
    }

    const occupied = new Set(agents.map(a => `${a.x},${a.y}`))

    agents.forEach(agent => {
      agent.age++
      agent.energy -= season === 'Winter' ? 1.5 : 0.8

      let bestDx = 0, bestDy = 0, bestScore = -Infinity
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (dx === 0 && dy === 0) continue
          const nx = agent.x + dx, ny = agent.y + dy
          if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue
          const tile = world[ny * GRID + nx]
          let score = Math.random() * 2 - 1
          if (tile === 'food') score += 10
          if (tile === 'water') score += 3
          if (tile === 'danger') score -= 15
          if (agent.type === 'social') {
            const nearby = agents.filter(a => a.id !== agent.id && Math.hypot(a.x - nx, a.y - ny) < 3)
            score += nearby.length * 2
          }
          if (agent.type === 'smart') {
            const dangerNear = agents.filter(a => {
              const ti = world[a.y * GRID + a.x]
              return ti === 'danger' && Math.hypot(a.x - nx, a.y - ny) < 4
            })
            score -= dangerNear.length * 3
          }
          if (score > bestScore) {
            bestScore = score
            bestDx = Math.sign(dx)
            bestDy = Math.sign(dy)
          }
        }
      }

      const nx = Math.max(0, Math.min(GRID - 1, agent.x + bestDx))
      const ny = Math.max(0, Math.min(GRID - 1, agent.y + bestDy))
      agent.x = nx
      agent.y = ny

      const tile = world[ny * GRID + nx]
      if (tile === 'food') {
        agent.energy = Math.min(100, agent.energy + 20 * foodMultiplier)
        world[ny * GRID + nx] = 'empty'
      } else if (tile === 'danger') {
        agent.energy -= 30
      }

      if (agent.type === 'social' && agent.energy > 30) {
        const nearby = agents.filter(a => a.id !== agent.id && Math.hypot(a.x - agent.x, a.y - agent.y) < 3 && a.energy < 20)
        nearby.forEach(a => {
          a.energy += 5
          agent.energy -= 5
          a.messages.push({ from: agent.id, type: 'help', tick: t })
        })
      }
    })

    if (t % 30 === 0) {
      const alive = agents.filter(a => a.energy > 0)
      alive.forEach(a => {
        if (a.energy > 70 && alive.length < 60) {
          const child = {
            id: Math.random() * 100000 | 0,
            x: a.x + (Math.random() > 0.5 ? 1 : -1),
            y: a.y + (Math.random() > 0.5 ? 1 : -1),
            energy: 30,
            type: Math.random() < 0.8 ? a.type : ['basic', 'smart', 'social'][Math.floor(Math.random() * 3)],
            dx: 0, dy: 0, age: 0, messages: [],
          }
          child.x = Math.max(0, Math.min(GRID - 1, child.x))
          child.y = Math.max(0, Math.min(GRID - 1, child.y))
          agents.push(child)
          a.energy -= 20
        }
      })
    }

    const survived = agents.filter(a => a.energy > 0)
    agentsRef.current = survived

    setStats({
      agents: survived.length,
      tick: t,
      season,
      smart: survived.filter(a => a.type === 'smart').length,
      social: survived.filter(a => a.type === 'social').length,
      basic: survived.filter(a => a.type === 'basic').length,
    })
  }, [])

  useEffect(() => {
    if (!running) return
    const interval = setInterval(tick, speed)
    return () => clearInterval(interval)
  }, [running, speed, tick])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    function draw() {
      const w = GRID * CELL
      canvas.width = w
      canvas.height = w
      ctx.fillStyle = COLORS.empty
      ctx.fillRect(0, 0, w, w)

      const world = worldRef.current
      for (let i = 0; i < world.length; i++) {
        if (world[i] === 'empty') continue
        const x = (i % GRID) * CELL, y = Math.floor(i / GRID) * CELL
        ctx.fillStyle = COLORS[world[i]]
        ctx.globalAlpha = 0.6
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
        ctx.globalAlpha = 1
      }

      agentsRef.current.forEach(agent => {
        const x = agent.x * CELL, y = agent.y * CELL
        const color = agent.type === 'smart' ? COLORS.agentSmart
          : agent.type === 'social' ? COLORS.agentSocial
          : COLORS.agent
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2)
        ctx.fill()

        const energyPct = agent.energy / 100
        ctx.fillStyle = energyPct > 0.5 ? '#22c55e' : energyPct > 0.2 ? '#fbbf24' : '#ef4444'
        ctx.fillRect(x, y - 2, CELL * energyPct, 1)
      })

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  const handleCanvasHover = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = (GRID * CELL) / rect.width
    const mx = Math.floor((e.clientX - rect.left) * scale / CELL)
    const my = Math.floor((e.clientY - rect.top) * scale / CELL)
    const agent = agentsRef.current.find(a => a.x === mx && a.y === my)
    setHoveredAgent(agent || null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          onClick={() => setRunning(!running)}
          className="px-4 py-2 rounded-lg bg-nebula-500 text-white border-none cursor-pointer hover:bg-nebula-600 transition font-medium"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <label className="flex items-center gap-2 text-gray-400">
          Geschwindigkeit:
          <input
            type="range" min="50" max="500" value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="w-24 accent-nebula-400"
          />
        </label>
        <button
          onClick={() => {
            worldRef.current = createWorld()
            agentsRef.current = createAgents()
            tickRef.current = 0
          }}
          className="px-4 py-2 rounded-lg bg-white/10 text-white border-none cursor-pointer hover:bg-white/20 transition font-medium"
        >
          Neustart
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="rounded-xl border border-white/10 w-full max-w-[640px] cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
            onMouseMove={handleCanvasHover}
            onMouseLeave={() => setHoveredAgent(null)}
          />
          {hoveredAgent && (
            <div className="absolute top-2 right-2 bg-cosmos-800/90 backdrop-blur border border-white/10 rounded-lg p-3 text-xs space-y-1 min-w-[160px]">
              <div className="font-bold text-white">Agent #{hoveredAgent.id}</div>
              <div>Typ: <span className={
                hoveredAgent.type === 'smart' ? 'text-nebula-400' :
                hoveredAgent.type === 'social' ? 'text-pink-400' : 'text-star-400'
              }>{hoveredAgent.type}</span></div>
              <div>Energie: {hoveredAgent.energy.toFixed(0)}%</div>
              <div>Alter: {hoveredAgent.age} Ticks</div>
              <div>Nachrichten: {hoveredAgent.messages.length}</div>
            </div>
          )}
        </div>

        <div className="bg-cosmos-800/50 backdrop-blur border border-white/10 rounded-xl p-4 space-y-3 min-w-[200px]">
          <h3 className="font-display font-bold text-white text-lg m-0">Statistiken</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Tick</span>
              <span className="text-white font-mono">{stats.tick}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Saison</span>
              <span className="text-white">{stats.season}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Agenten</span>
              <span className="text-white font-mono">{stats.agents}</span>
            </div>
            <hr className="border-white/10" />
            <div className="flex justify-between">
              <span className="text-star-400">Basic</span>
              <span className="text-white font-mono">{stats.basic || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nebula-400">Smart</span>
              <span className="text-white font-mono">{stats.smart || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pink-400">Social</span>
              <span className="text-white font-mono">{stats.social || 0}</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="font-display text-white text-sm font-bold mb-2">Legende</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[
                ['Nahrung', '#22c55e'],
                ['Wasser', '#3b82f6'],
                ['Gefahr', '#ef4444'],
                ['Basic', '#fbbf24'],
                ['Smart', '#7c3aed'],
                ['Social', '#ec4899'],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
