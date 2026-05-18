import { useEffect, useRef, useState, useCallback } from 'react'
import { useWorld } from '../contexts/WorldContext'

const CELL = 16
const GAP = 1
const STEP = CELL + GAP

const TILE_COLORS = {
  e: [15, 15, 30],
  f: [34, 197, 94],
  w: [59, 130, 246],
  d: [239, 68, 68],
  t: [22, 163, 74],
  b: [168, 85, 247],
  s: [234, 179, 8],
  p: [127, 29, 29],
  r: [120, 113, 108],
  F: [76, 175, 80],
}

const SEASON_LABELS = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' }
const PHASE_LABELS = { work: 'Arbeit', free: 'Freizeit', sleep: 'Schlaf' }
const SEASON_COLORS = { spring: '#22c55e', summer: '#fbbf24', autumn: '#f97316', winter: '#60a5fa' }
const PHASE_COLORS = { work: '#f97316', free: '#34d399', sleep: '#60a5fa' }

export default function WorldCanvas() {
  const { worldState, tiles, agents, events, loading, error } = useWorld()
  const canvasRef = useRef(null)
  const [hoveredAgent, setHoveredAgent] = useState(null)
  const [showEvents, setShowEvents] = useState(true)

  const gridSize = worldState?.grid_size ?? 30

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !tiles) return
    const ctx = canvas.getContext('2d')
    const size = gridSize * STEP - GAP
    canvas.width = size
    canvas.height = size

    ctx.fillStyle = '#050510'
    ctx.fillRect(0, 0, size, size)

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = y * gridSize + x
        const tile = tiles[idx] || 'e'
        const color = TILE_COLORS[tile] || TILE_COLORS.e
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
        ctx.fillRect(x * STEP, y * STEP, CELL, CELL)
      }
    }

    for (const agent of agents) {
      if (!agent.alive) continue
      const ax = agent.x * STEP + CELL / 2
      const ay = agent.y * STEP + CELL / 2
      const radius = CELL * 0.45

      const energyRatio = agent.energy / 100
      const r = Math.round(251 * (1 - agent.reputation * 0.3))
      const g = Math.round(191 * energyRatio)
      const b = Math.round(36 + agent.reputation * 100)

      ctx.beginPath()
      ctx.arc(ax, ay, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fill()

      if (agent.day_phase === 'sleep') {
        ctx.globalAlpha = 0.4
        ctx.fillStyle = '#60a5fa'
        ctx.font = `${CELL * 0.5}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('z', ax, ay - radius - 2)
        ctx.globalAlpha = 1
      }

      if (agent.imprisoned_until) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.strokeRect(agent.x * STEP - 1, agent.y * STEP - 1, CELL + 2, CELL + 2)
      }

      if (agent.energy < 20) {
        ctx.strokeStyle = '#ef444480'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(ax, ay, radius + 3, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }, [tiles, agents, gridSize])

  useEffect(() => {
    draw()
  }, [draw])

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY
    const gx = Math.floor(mx / STEP)
    const gy = Math.floor(my / STEP)

    const clicked = agents.find(a => a.alive && a.x === gx && a.y === gy)
    setHoveredAgent(clicked || null)
  }, [agents])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-nebula-400 border-t-transparent rounded-full mr-3" />
        Lade Welt...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-32 text-danger-400">
        Fehler: {error}
      </div>
    )
  }

  const season = worldState?.season ?? 'spring'
  const dayPhase = worldState?.day_phase ?? 'work'
  const tick = worldState?.tick ?? 0
  const aliveCount = agents.filter(a => a.alive).length

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Tick</span>
          <span className="text-white font-mono font-bold">{tick}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEASON_COLORS[season] }} />
          <span style={{ color: SEASON_COLORS[season] }}>{SEASON_LABELS[season]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[dayPhase] }} />
          <span style={{ color: PHASE_COLORS[dayPhase] }}>{PHASE_LABELS[dayPhase]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Agenten</span>
          <span className="text-white font-mono">{aliveCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Tag</span>
          <span className="text-white font-mono">{Math.floor(tick / 240)}</span>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-cosmos-800 p-2">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair"
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
          />
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Agent Detail */}
          {hoveredAgent && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <h4 className="font-display text-white font-bold text-sm mb-2">{hoveredAgent.name}</h4>
              <div className="space-y-1 text-xs text-gray-400">
                <div>Energie: <span className="text-white font-mono">{Math.round(hoveredAgent.energy)}</span></div>
                <div>Alter: <span className="text-white font-mono">{hoveredAgent.age}</span> / {hoveredAgent.max_age}</div>
                <div>Position: <span className="text-white font-mono">({hoveredAgent.x}, {hoveredAgent.y})</span></div>
                <div>Reputation: <span className="text-white font-mono">{hoveredAgent.reputation?.toFixed(2)}</span></div>
                <div>Generation: <span className="text-white font-mono">{hoveredAgent.generation}</span></div>
                <div className="pt-2 border-t border-white/5 mt-2">
                  {Object.entries(hoveredAgent.personality || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="text-white font-mono">{Number(v).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Events */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <button
              onClick={() => setShowEvents(!showEvents)}
              className="w-full flex items-center justify-between text-sm font-display text-white font-bold bg-transparent border-none cursor-pointer p-0"
            >
              Ereignisse
              <span className="text-gray-500 text-xs">{showEvents ? '▲' : '▼'}</span>
            </button>
            {showEvents && (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-xs text-gray-500">Noch keine Ereignisse</p>
                ) : (
                  events.slice(0, 15).map((evt, i) => (
                    <div key={i} className="text-xs text-gray-400 py-1 border-b border-white/5 last:border-0">
                      <span className="text-gray-500 font-mono mr-1">T{evt.tick}</span>
                      <span className={
                        evt.event_type === 'death' ? 'text-danger-400' :
                        evt.event_type === 'birth' ? 'text-life-400' :
                        evt.event_type === 'disaster' ? 'text-energy-400' :
                        evt.event_type === 'season_change' ? 'text-star-300' :
                        evt.event_type === 'arrest' ? 'text-red-300' :
                        evt.event_type === 'crime' ? 'text-red-500' :
                        evt.event_type === 'communication' ? 'text-blue-300' :
                        evt.event_type === 'build' ? 'text-purple-300' :
                        'text-gray-300'
                      }>
                        {evt.event_type === 'death' && `☠ ${evt.detail?.name} (${evt.detail?.cause})`}
                        {evt.event_type === 'birth' && `🌱 ${evt.detail?.child} geboren`}
                        {evt.event_type === 'disaster' && `⚡ ${evt.detail?.type} bei (${evt.detail?.center?.[0]}, ${evt.detail?.center?.[1]})`}
                        {evt.event_type === 'season_change' && `🌍 ${SEASON_LABELS[evt.detail?.season] || evt.detail?.season}`}
                        {evt.event_type === 'arrest' && `🔒 ${evt.detail?.arrested} verhaftet von ${evt.detail?.by}`}
                        {evt.event_type === 'crime' && `💀 ${evt.detail?.thief} bestiehlt ${evt.detail?.victim}`}
                        {evt.event_type === 'communication' && `💬 ${evt.detail?.from} → ${evt.detail?.to}`}
                        {evt.event_type === 'build' && `🏗 ${evt.detail?.builder} baut ${evt.detail?.type === 'F' ? 'Farm' : evt.detail?.type === 's' ? 'Unterschlupf' : evt.detail?.type === 'r' ? 'Straße' : 'Gebäude'}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="font-display text-white font-bold text-sm mb-2">Statistiken</h4>
            <div className="space-y-1 text-xs text-gray-400">
              {(() => {
                const alive = agents.filter(a => a.alive)
                const avgEnergy = alive.length > 0 ? (alive.reduce((s, a) => s + a.energy, 0) / alive.length).toFixed(0) : 0
                const avgRep = alive.length > 0 ? (alive.reduce((s, a) => s + a.reputation, 0) / alive.length).toFixed(2) : 0
                const maxGen = alive.length > 0 ? Math.max(...alive.map(a => a.generation)) : 0
                const imprisoned = alive.filter(a => a.imprisoned_until).length
                const births = events.filter(e => e.event_type === 'birth').length
                const deaths = events.filter(e => e.event_type === 'death').length
                const crimes = events.filter(e => e.event_type === 'crime').length
                const builds = events.filter(e => e.event_type === 'build').length
                return (
                  <>
                    <div className="flex justify-between"><span>Avg. Energie</span><span className="text-white font-mono">{avgEnergy}</span></div>
                    <div className="flex justify-between"><span>Avg. Reputation</span><span className="text-white font-mono">{avgRep}</span></div>
                    <div className="flex justify-between"><span>Max. Generation</span><span className="text-white font-mono">{maxGen}</span></div>
                    <div className="flex justify-between"><span>Im Gefängnis</span><span className="text-white font-mono">{imprisoned}</span></div>
                    <div className="flex justify-between"><span>Geburten (sichtbar)</span><span className="text-life-400 font-mono">{births}</span></div>
                    <div className="flex justify-between"><span>Tode (sichtbar)</span><span className="text-danger-400 font-mono">{deaths}</span></div>
                    {crimes > 0 && <div className="flex justify-between"><span>Verbrechen</span><span className="text-red-500 font-mono">{crimes}</span></div>}
                    {builds > 0 && <div className="flex justify-between"><span>Gebaut</span><span className="text-purple-300 font-mono">{builds}</span></div>}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="font-display text-white font-bold text-sm mb-2">Legende</h4>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
              {[
                ['f', 'Nahrung', '#22c55e'],
                ['w', 'Wasser', '#3b82f6'],
                ['t', 'Baum', '#16a34a'],
                ['d', 'Gefahr', '#ef4444'],
                ['b', 'Gebäude', '#a855f7'],
                ['s', 'Unterschlupf', '#eab308'],
                ['F', 'Farm', '#4caf50'],
                ['r', 'Straße', '#78716c'],
              ].map(([, label, color]) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
              <div className="flex items-center gap-1 col-span-2 mt-1">
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                Agent (Farbe = Energie/Reputation)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
