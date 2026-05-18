import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { useWorld } from '../contexts/WorldContext'
import { isLand, landBaseColor, OCEAN_COLOR } from '../lib/landMask'

const SKY_TEXTURE = 'https://unpkg.com/three-globe/example/img/night-sky.png'

// 1x1 pixel dark ocean globe texture (no earth image)
const DARK_GLOBE = (() => {
  const c = document.createElement('canvas')
  c.width = 1; c.height = 1
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#0a1e3d'
  ctx.fillRect(0, 0, 1, 1)
  return c.toDataURL()
})()

const TILE_COLORS = {
  f: '#22c55e', w: '#3b82f6', d: '#ef4444', t: '#16a34a',
  b: '#a855f7', s: '#eab308', p: '#7f1d1d', r: '#78716c', F: '#4caf50', P: '#64a0dc',
}

const SEASON_LABELS = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' }
const PHASE_LABELS = { work: 'Arbeit', free: 'Freizeit', sleep: 'Schlaf' }
const SEASON_COLORS = { spring: '#22c55e', summer: '#fbbf24', autumn: '#f97316', winter: '#60a5fa' }
const PHASE_COLORS = { work: '#f97316', free: '#34d399', sleep: '#60a5fa' }

function gridToGeo(col, row, gridSize) {
  const lat = 80 - (row / (gridSize - 1)) * 160
  const lng = -160 + (col / (gridSize - 1)) * 320
  return { lat, lng }
}

// Create a flat hex THREE.js mesh (no side faces = no artifacts)
function createHexMesh(color, size) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    const x = size * Math.cos(angleRad)
    const y = size * Math.sin(angleRad)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geometry, material)
}

function rgbStr([r, g, b]) {
  return `rgb(${r},${g},${b})`
}

function getAgentColor(agent) {
  const energyRatio = agent.energy / 100
  const r = Math.round(251 * (1 - agent.reputation * 0.3))
  const g = Math.round(191 * energyRatio)
  const b = Math.round(36 + agent.reputation * 100)
  return `rgb(${r}, ${g}, ${b})`
}

export default function WorldGlobe() {
  const { worldState, tiles, agents, events, loading, error } = useWorld()
  const globeRef = useRef()
  const containerRef = useRef(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showEvents, setShowEvents] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 })
  const [globeReady, setGlobeReady] = useState(false)

  const gridSize = worldState?.grid_size ?? 30

  // Hex size in degrees — visible but not overlapping
  const latStep = 160 / (gridSize - 1)
  const lngStep = 320 / (gridSize - 1)
  const hexLatR = latStep * 0.38
  const hexLngR = lngStep * 0.38

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      if (width > 0) setDimensions({ width, height: Math.min(width * 0.75, 600) })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!globeReady || !globeRef.current) return
    const controls = globeRef.current.controls()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
      controls.enableDamping = true
      controls.minDistance = 150
      controls.maxDistance = 500
    }
  }, [globeReady])

  // Hex data for land tiles — rendered as flat custom THREE.js objects
  const hexData = useMemo(() => {
    if (!tiles) return []
    const data = []
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!isLand(col, row)) continue
        const tile = tiles[row * gridSize + col] || 'e'
        const { lat, lng } = gridToGeo(col, row, gridSize)
        const lngOffset = (row % 2 === 1) ? lngStep * 0.5 : 0

        let color
        if (tile !== 'e' && TILE_COLORS[tile]) {
          color = TILE_COLORS[tile]
        } else {
          color = rgbStr(landBaseColor(row))
        }

        data.push({ lat, lng: lng + lngOffset, color, col, row, tile })
      }
    }
    return data
  }, [tiles, gridSize, lngStep])

  // Agent points (on top of hex tiles)
  const agentPoints = useMemo(() => {
    return agents
      .filter(a => a.alive)
      .map(a => {
        const { lat, lng } = gridToGeo(a.x, a.y, gridSize)
        const lngOffset = (a.y % 2 === 1) ? lngStep * 0.5 : 0
        return {
          ...a,
          lat, lng: lng + lngOffset,
          color: getAgentColor(a),
          size: 0.35 + (a.energy / 100) * 0.25,
          altitude: 0.012,
        }
      })
  }, [agents, gridSize, lngStep])

  const handlePointClick = useCallback((point) => {
    if (point.name) {
      setSelectedAgent(point)
      if (globeRef.current) {
        globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.5 }, 800)
      }
    }
  }, [])

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-nebula-400 border-t-transparent rounded-full mr-3" />
        Lade Welt...
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-32 text-danger-400">Fehler: {error}</div>
  }

  const season = worldState?.season ?? 'spring'
  const dayPhase = worldState?.day_phase ?? 'work'
  const tick = worldState?.tick ?? 0
  const aliveCount = agents.filter(a => a.alive).length

  return (
    <div className="space-y-4">
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
        <div ref={containerRef} className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-cosmos-800" style={{ minHeight: 400 }}>
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundImageUrl={SKY_TEXTURE}
            globeImageUrl={DARK_GLOBE}
            atmosphereColor="#6366f1"
            atmosphereAltitude={0.12}
            // Hex land tiles as flat custom meshes (no side-face artifacts)
            objectsData={hexData}
            objectThreeObject={d => createHexMesh(d.color, 6)}
            objectLat="lat"
            objectLng="lng"
            objectAltitude={0.001}
            objectFacesSurface={true}
            // Agent points
            pointsData={agentPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius="size"
            pointLabel={d => d.name ? `
              <div style="background:#1a1a2e;border:1px solid #6366f1;border-radius:8px;padding:8px 12px;font-size:12px;color:white;min-width:120px">
                <div style="font-weight:bold;margin-bottom:4px">${d.name}</div>
                <div style="color:#94a3b8">Energie: <span style="color:white;font-family:monospace">${Math.round(d.energy)}</span></div>
                <div style="color:#94a3b8">Rep: <span style="color:white;font-family:monospace">${d.reputation?.toFixed(2)}</span></div>
                <div style="color:#94a3b8">Gen: <span style="color:white;font-family:monospace">${d.generation}</span></div>
              </div>
            ` : ''}
            onPointClick={handlePointClick}
            onGlobeReady={handleGlobeReady}
            animateIn={true}
          />
        </div>

        <div className="w-full lg:w-72 space-y-4">
          {selectedAgent && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display text-white font-bold text-sm">{selectedAgent.name}</h4>
                <button onClick={() => setSelectedAgent(null)} className="text-gray-500 hover:text-white text-xs bg-transparent border-none cursor-pointer">x</button>
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                <div>Energie: <span className="text-white font-mono">{Math.round(selectedAgent.energy)}</span></div>
                <div>Alter: <span className="text-white font-mono">{selectedAgent.age}</span> / {selectedAgent.max_age}</div>
                <div>Position: <span className="text-white font-mono">({selectedAgent.x}, {selectedAgent.y})</span></div>
                <div>Reputation: <span className="text-white font-mono">{selectedAgent.reputation?.toFixed(2)}</span></div>
                <div>Generation: <span className="text-white font-mono">{selectedAgent.generation}</span></div>
                <div className="pt-2 border-t border-white/5 mt-2">
                  {Object.entries(selectedAgent.personality || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="text-white font-mono">{Number(v).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                return (
                  <>
                    <div className="flex justify-between"><span>Avg. Energie</span><span className="text-white font-mono">{avgEnergy}</span></div>
                    <div className="flex justify-between"><span>Avg. Reputation</span><span className="text-white font-mono">{avgRep}</span></div>
                    <div className="flex justify-between"><span>Max. Generation</span><span className="text-white font-mono">{maxGen}</span></div>
                    <div className="flex justify-between"><span>Im Gefängnis</span><span className="text-white font-mono">{imprisoned}</span></div>
                    <div className="flex justify-between"><span>Geburten</span><span className="text-life-400 font-mono">{births}</span></div>
                    <div className="flex justify-between"><span>Tode</span><span className="text-danger-400 font-mono">{deaths}</span></div>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="font-display text-white font-bold text-sm mb-2">Legende</h4>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
              {[
                ['Nahrung', '#22c55e'], ['Wasser', '#3b82f6'], ['Baum', '#16a34a'],
                ['Gefahr', '#ef4444'], ['Gebäude', '#a855f7'], ['Unterschlupf', '#eab308'],
                ['Farm', '#4caf50'], ['Straße', '#78716c'],
              ].map(([label, color]) => (
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
