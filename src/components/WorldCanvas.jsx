import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useWorld } from '../contexts/WorldContext'
import { useAuth } from '../contexts/AuthContext'
import { isLand, landBaseColor, OCEAN_COLOR, hexNeighbors } from '../lib/landMask'
import { hexToPixel, pixelToHex, hexCorners, canvasSize } from '../lib/hexUtils'
import { setMoveTarget, fetchDynastyState } from '../lib/worldService'
import { familyIds, emojiForAgent } from '../lib/familyUtils'

// Larger hex for Freeciv-style detail
const HEX = 28
const SQRT3 = Math.sqrt(3)

function hexToPixelLocal(col, row) {
  const x = HEX * SQRT3 * (col + 0.5 * (row & 1))
  const y = HEX * 1.5 * row
  return [x, y]
}

function hexCornersLocal(cx, cy, size) {
  const c = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30)
    c.push([cx + size * Math.cos(a), cy + size * Math.sin(a)])
  }
  return c
}

// Seeded RNG for deterministic terrain details
function seededRng(seed) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

// Freeciv-style terrain colors (richer palette)
const TERRAIN = {
  polar:    { base: [200, 215, 230], grass: [190, 210, 225], detail: 'snow' },
  tundra:   { base: [145, 160, 115], grass: [135, 150, 105], detail: 'scrub' },
  temperate:{ base: [85, 140, 60],   grass: [75, 130, 55],   detail: 'trees' },
  steppe:   { base: [175, 165, 100], grass: [165, 155, 90],  detail: 'brush' },
  desert:   { base: [210, 190, 130], grass: [200, 180, 120], detail: 'sand' },
  tropical: { base: [45, 120, 45],   grass: [40, 115, 40],   detail: 'jungle' },
}

function getTerrainType(row) {
  if (row <= 2 || row >= 24) return 'polar'
  if (row <= 4 || row >= 21) return 'tundra'
  if (row <= 6 || row >= 18) return 'temperate'
  if (row <= 8 || row >= 15) return 'steppe'
  if (row <= 10) return 'desert'
  return 'tropical'
}

// Role emoji/symbols for agents
const ROLE_SYMBOLS = {
  farmer: '🌾', builder: '🔨', researcher: '📖', guard: '⚔', trader: '💰', generalist: '●',
}
const ROLE_COLORS = {
  farmer: '#84cc16', builder: '#a855f7', researcher: '#06b6d4', guard: '#ef4444', trader: '#f59e0b', generalist: '#94a3b8',
}

// Tile type config (Freeciv-style)
const TILE_CONFIG = {
  f: { color: [50, 165, 70],   icon: '🍎', label: 'Nahrung' },
  w: { color: [50, 120, 200],  icon: '💧', label: 'Wasser' },
  d: { color: [180, 60, 50],   icon: '☠',  label: 'Gefahr' },
  b: { color: [130, 100, 170], icon: '🏠', label: 'Gebäude' },
  s: { color: [180, 150, 50],  icon: '⛺', label: 'Unterschlupf' },
  F: { color: [100, 160, 50],  icon: '🌾', label: 'Farm' },
  r: { color: [150, 140, 130], icon: '',    label: 'Straße' },
  P: { color: [80, 130, 180],  icon: '⚓', label: 'Hafen' },
  A: { color: [90, 150, 70],   icon: '🦌', label: 'Wildtier' },
}

const MIN_ZOOM = 0.3
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.15

export default function WorldCanvas({ onSelectAgent, myAgent }) {
  const { worldState, tiles, agents, loading, error } = useWorld()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hoveredAgent, setHoveredAgent] = useState(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [moveTargetFlash, setMoveTargetFlash] = useState(null)
  const [dynasty, setDynasty] = useState(null)

  useEffect(() => {
    fetchDynastyState().then(setDynasty)
  }, [])

  const familyIdSet = useMemo(
    () => familyIds(dynasty?.mainAgentId, agents ?? []),
    [dynasty?.mainAgentId, agents]
  )

  const dragStart = useRef(null)
  const animFrame = useRef(0)

  const gridSize = worldState?.grid_size ?? 60
  const PAD = HEX + 8

  // Center on own agent on first load
  const centeredRef = useRef(false)
  useEffect(() => {
    if (centeredRef.current || !wrapRef.current || !agents?.length) return
    const ownAgent = myAgent ?? agents.find(a => a.alive && a.owner_id === user?.id)
    if (!ownAgent) return
    centeredRef.current = true
    const [px, py] = hexToPixelLocal(ownAgent.x, ownAgent.y)
    const rect = wrapRef.current.getBoundingClientRect()
    setCamera({ x: rect.width / 2 - (px + PAD), y: rect.height / 2 - (py + PAD) })
    setZoom(1.5)
  }, [agents, myAgent, user, PAD])

  // Auto-pan to main_agent when dynasty resolves
  const dynastyCenteredRef = useRef(false)
  useEffect(() => {
    if (dynastyCenteredRef.current || !dynasty?.mainAgentId || !agents?.length || !wrapRef.current) return
    const main = agents.find((a) => a.id === dynasty.mainAgentId)
    if (!main) return
    dynastyCenteredRef.current = true
    const [px, py] = hexToPixelLocal(main.x, main.y)
    const rect = wrapRef.current.getBoundingClientRect()
    setCamera({ x: rect.width / 2 - (px + PAD), y: rect.height / 2 - (py + PAD) })
    setZoom(1.5)
  }, [dynasty?.mainAgentId, agents?.length, PAD])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !tiles) return
    const ctx = canvas.getContext('2d')
    const totalW = Math.ceil(HEX * SQRT3 * (gridSize + 0.5)) + PAD * 2
    const totalH = Math.ceil(HEX * 1.5 * (gridSize - 1) + HEX * 2) + PAD * 2
    canvas.width = totalW
    canvas.height = totalH

    const rng = seededRng(42)

    // --- Background ocean fill ---
    ctx.fillStyle = '#0a1a2e'
    ctx.fillRect(0, 0, totalW, totalH)

    // --- Draw hex tiles ---
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const [px, py] = hexToPixelLocal(col, row)
        const cx = px + PAD
        const cy = py + PAD
        const idx = row * gridSize + col
        const tile = tiles[idx] || 'e'
        const land = isLand(col, row)
        const corners = hexCornersLocal(cx, cy, HEX)

        // Draw hex shape
        ctx.beginPath()
        ctx.moveTo(corners[0][0], corners[0][1])
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1])
        ctx.closePath()

        if (!land) {
          // Ocean — depth gradient with wave pattern
          const depth = Math.sin(col * 0.5 + row * 0.3) * 12
          const n = rng() * 8 - 4
          ctx.fillStyle = `rgb(${14 + depth + n}, ${35 + depth + n}, ${75 + depth * 1.5 + n})`
          ctx.fill()
          // Subtle hex border
          ctx.strokeStyle = 'rgba(30, 60, 110, 0.3)'
          ctx.lineWidth = 0.5
          ctx.stroke()
          // Wave ripples
          if (rng() > 0.6) {
            ctx.strokeStyle = `rgba(60, 110, 170, ${0.12 + rng() * 0.1})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            const wy = cy + (rng() - 0.5) * HEX * 0.5
            ctx.moveTo(cx - HEX * 0.35, wy)
            ctx.quadraticCurveTo(cx, wy + (rng() - 0.5) * 4, cx + HEX * 0.35, wy)
            ctx.stroke()
          }
        } else {
          // Land tile
          const tconf = TILE_CONFIG[tile]
          if (tconf && tile !== 'e') {
            // Special tile — flat Civ-style colored hex
            const [tr, tg, tb] = tconf.color
            const n = rng() * 12 - 6
            ctx.fillStyle = `rgb(${tr + n}, ${tg + n}, ${tb + n})`
            ctx.fill()
            ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.5)`
            ctx.lineWidth = 1
            ctx.stroke()

            // Draw road as dashed line through hex
            if (tile === 'r') {
              ctx.strokeStyle = 'rgba(120, 110, 100, 0.7)'
              ctx.lineWidth = 2
              ctx.setLineDash([3, 3])
              ctx.beginPath()
              ctx.moveTo(cx - HEX * 0.4, cy)
              ctx.lineTo(cx + HEX * 0.4, cy)
              ctx.stroke()
              ctx.setLineDash([])
            }

            // Icon for special tiles
            if (tconf.icon) {
              ctx.font = `${HEX * 0.55}px serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(tconf.icon, cx, cy)
            }
          } else {
            // Empty land — terrain-based Freeciv-style rendering
            const ttype = getTerrainType(row)
            const terrain = TERRAIN[ttype]
            const [br, bg, bb] = terrain.base
            const n1 = rng() * 18 - 9
            const n2 = rng() * 18 - 9
            const n3 = rng() * 18 - 9
            ctx.fillStyle = `rgb(${br + n1}, ${bg + n2}, ${bb + n3})`
            ctx.fill()

            // Hex grid border (subtle)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
            ctx.lineWidth = 0.5
            ctx.stroke()

            // Terrain details
            if (terrain.detail === 'trees' || terrain.detail === 'jungle') {
              // Draw little tree dots
              for (let t = 0; t < 4; t++) {
                const tx = cx + (rng() - 0.5) * HEX * 0.8
                const ty = cy + (rng() - 0.5) * HEX * 0.7
                const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2)
                if (dist < HEX * 0.6) {
                  const treeSize = 2 + rng() * 2
                  ctx.fillStyle = terrain.detail === 'jungle'
                    ? `rgba(20, ${80 + rng() * 40}, 20, ${0.5 + rng() * 0.3})`
                    : `rgba(40, ${100 + rng() * 40}, 30, ${0.4 + rng() * 0.3})`
                  ctx.beginPath()
                  ctx.arc(tx, ty - treeSize, treeSize, 0, Math.PI * 2)
                  ctx.fill()
                  // Trunk
                  ctx.fillStyle = 'rgba(80, 50, 20, 0.4)'
                  ctx.fillRect(tx - 0.5, ty - treeSize * 0.5, 1, treeSize)
                }
              }
            } else if (terrain.detail === 'sand') {
              // Sandy dots
              for (let d = 0; d < 5; d++) {
                const dx = cx + (rng() - 0.5) * HEX * 0.7
                const dy = cy + (rng() - 0.5) * HEX * 0.6
                if (Math.sqrt((dx - cx) ** 2 + (dy - cy) ** 2) < HEX * 0.55) {
                  ctx.fillStyle = `rgba(${200 + rng() * 30}, ${180 + rng() * 20}, ${120 + rng() * 20}, 0.3)`
                  ctx.fillRect(dx, dy, 1.5, 1.5)
                }
              }
            } else if (terrain.detail === 'snow') {
              // Snow sparkles
              for (let s = 0; s < 3; s++) {
                const sx = cx + (rng() - 0.5) * HEX * 0.6
                const sy = cy + (rng() - 0.5) * HEX * 0.5
                ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + rng() * 0.2})`
                ctx.beginPath()
                ctx.arc(sx, sy, 1, 0, Math.PI * 2)
                ctx.fill()
              }
            } else if (terrain.detail === 'scrub') {
              // Tundra scrub
              for (let s = 0; s < 3; s++) {
                const sx = cx + (rng() - 0.5) * HEX * 0.7
                const sy = cy + (rng() - 0.5) * HEX * 0.6
                if (Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2) < HEX * 0.55) {
                  ctx.fillStyle = `rgba(100, 120, 70, ${0.3 + rng() * 0.2})`
                  ctx.fillRect(sx - 1.5, sy, 3, 2)
                }
              }
            } else if (terrain.detail === 'brush') {
              // Steppe brush
              for (let b = 0; b < 2; b++) {
                const bx = cx + (rng() - 0.5) * HEX * 0.6
                const by = cy + (rng() - 0.5) * HEX * 0.5
                ctx.strokeStyle = `rgba(140, 130, 80, ${0.3 + rng() * 0.2})`
                ctx.lineWidth = 0.8
                ctx.beginPath()
                ctx.moveTo(bx, by)
                ctx.lineTo(bx + (rng() - 0.5) * 5, by - 3 - rng() * 3)
                ctx.stroke()
              }
            }
          }
        }
      }
    }

    // --- Coastlines (land next to ocean — thicker white glow) ---
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!isLand(col, row)) continue
        const nbrs = hexNeighbors(col, row, gridSize)
        const hasOcean = nbrs.some(([c, r]) => !isLand(c, r))
          || col === 0 || row === 0 || col === gridSize - 1 || row === gridSize - 1
        if (!hasOcean) continue

        const [px, py] = hexToPixelLocal(col, row)
        const cx = px + PAD, cy = py + PAD
        const corners = hexCornersLocal(cx, cy, HEX)

        // Coastline glow
        ctx.beginPath()
        ctx.moveTo(corners[0][0], corners[0][1])
        for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1])
        ctx.closePath()
        ctx.strokeStyle = 'rgba(180, 210, 255, 0.25)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Beach fringe on ocean side
        ctx.strokeStyle = 'rgba(230, 220, 180, 0.12)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    // --- Draw Agents (Freeciv unit style) ---
    const aliveAgents = agents.filter(a => a.alive)
    for (const agent of aliveAgents) {
      const [px, py] = hexToPixelLocal(agent.x, agent.y)
      const ax = px + PAD
      const ay = py + PAD
      const role = agent.role ?? 'generalist'
      const roleColor = ROLE_COLORS[role] ?? '#94a3b8'

      // Unit background plate (rounded rect like Civ units)
      const plateW = HEX * 0.9
      const plateH = HEX * 0.7
      const plateX = ax - plateW / 2
      const plateY = ay - plateH / 2

      // Dynasty glow / family rim
      const isMain = dynasty?.mainAgentId && agent.id === dynasty.mainAgentId
      const isFamily = familyIdSet.has(agent.id) && !isMain

      if (isMain) {
        // Pulsierender Glow-Outline für Hauptchar
        const t = (performance.now() / 600)
        const pulse = 0.6 + Math.sin(t) * 0.4
        const glowPad = 6 + pulse * 4
        ctx.save()
        roundRect(ctx, plateX - glowPad, plateY - glowPad, plateW + glowPad * 2, plateH + glowPad * 2, 7)
        ctx.strokeStyle = `rgba(252, 211, 77, ${0.5 + pulse * 0.4})`
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.restore()
      } else if (isFamily) {
        ctx.save()
        roundRect(ctx, plateX - 3, plateY - 3, plateW + 6, plateH + 6, 6)
        ctx.strokeStyle = 'rgba(252, 211, 77, 0.7)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      roundRect(ctx, plateX + 1, plateY + 1, plateW, plateH, 4)
      ctx.fill()

      // Plate
      ctx.fillStyle = agent.day_phase === 'sleep' ? 'rgba(30, 40, 80, 0.85)' : 'rgba(20, 25, 40, 0.85)'
      roundRect(ctx, plateX, plateY, plateW, plateH, 4)
      ctx.fill()

      // Role-colored border
      ctx.strokeStyle = roleColor
      ctx.lineWidth = agent.veteran ? 2.5 : 1.5
      ctx.stroke()

      // Veteran gold star
      if (agent.veteran) {
        ctx.fillStyle = '#fbbf24'
        ctx.font = `${HEX * 0.3}px sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText('★', ax + plateW / 2 - 1, ay - plateH / 2 + 1)
      }

      // Role icon
      ctx.font = `${HEX * 0.42}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ROLE_SYMBOLS[role] ?? '●', ax, ay - 1)

      // Energy bar below plate
      const barW = plateW - 4
      const barH = 3
      const barX = ax - barW / 2
      const barY = ay + plateH / 2 + 2
      const ePct = Math.max(0, Math.min(1, (agent.energy ?? 0) / 100))

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = ePct > 0.5 ? '#22c55e' : ePct > 0.2 ? '#eab308' : '#ef4444'
      ctx.fillRect(barX, barY, barW * ePct, barH)

      // Agent name (tiny text below)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = `bold ${HEX * 0.28}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(agent.name.length > 8 ? agent.name.slice(0, 7) + '…' : agent.name, ax, barY + barH + 1)

      // Imprisoned indicator
      if (agent.imprisoned_until) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([2, 2])
        roundRect(ctx, plateX - 2, plateY - 2, plateW + 4, plateH + 4, 5)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Low energy warning pulse
      if (agent.energy < 20) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
        ctx.lineWidth = 1
        roundRect(ctx, plateX - 3, plateY - 3, plateW + 6, plateH + 6, 6)
        ctx.stroke()
      }

      // Emoji overlay (drawn last so it appears on top of role icon)
      const emojiChar = isMain && dynasty?.emoji
        ? dynasty.emoji
        : emojiForAgent(agent)
      if (emojiChar) {
        ctx.save()
        ctx.font = `${Math.round(HEX * 0.48)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", emoji`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(emojiChar, ax, ay - 1)
        ctx.restore()
      }
    }

    // --- Move target marker (pulsing flag) ---
    const ownAgent = myAgent ?? agents.find(a => a.alive && a.owner_id === user?.id)
    if (ownAgent && ownAgent.move_target_x != null && ownAgent.move_target_y != null) {
      const [mtx, mty] = hexToPixelLocal(ownAgent.move_target_x, ownAgent.move_target_y)
      const mx = mtx + PAD, my = mty + PAD
      const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7

      // Target ring
      ctx.beginPath()
      ctx.arc(mx, my, HEX * 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(59, 130, 246, ${pulse})`
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Flag icon
      ctx.fillStyle = `rgba(59, 130, 246, ${pulse})`
      ctx.font = `${HEX * 0.5}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🚩', mx, my)

      // Line from agent to target
      if (ownAgent.x !== ownAgent.move_target_x || ownAgent.y !== ownAgent.move_target_y) {
        const [ax, ay] = hexToPixelLocal(ownAgent.x, ownAgent.y)
        ctx.beginPath()
        ctx.moveTo(ax + PAD, ay + PAD)
        ctx.lineTo(mx, my)
        ctx.strokeStyle = `rgba(59, 130, 246, ${pulse * 0.3})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 5])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // --- Highlight own agent with glow ring ---
    if (ownAgent) {
      const [oax, oay] = hexToPixelLocal(ownAgent.x, ownAgent.y)
      const ox = oax + PAD, oy = oay + PAD
      const glow = Math.sin(Date.now() * 0.003) * 0.15 + 0.35
      ctx.beginPath()
      ctx.arc(ox, oy, HEX * 0.7, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(139, 92, 246, ${glow})`
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // --- Flash effect for move command ---
    if (moveTargetFlash) {
      const [fx, fy] = hexToPixelLocal(moveTargetFlash.x, moveTargetFlash.y)
      const fcx = fx + PAD, fcy = fy + PAD
      const elapsed = Date.now() - moveTargetFlash.time
      if (elapsed < 600) {
        const alpha = 1 - elapsed / 600
        const size = HEX * (0.5 + elapsed / 600 * 0.5)
        ctx.beginPath()
        ctx.arc(fcx, fcy, size, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    // --- Grid coordinate labels (every 5th row/col) ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.font = `${HEX * 0.3}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < gridSize; i += 5) {
      const [px0, py0] = hexToPixelLocal(i, 0)
      ctx.fillText(String(i), px0 + PAD, PAD * 0.4)
      const [px1, py1] = hexToPixelLocal(0, i)
      ctx.fillText(String(i), PAD * 0.35, py1 + PAD)
    }

  }, [tiles, agents, gridSize, PAD, user, myAgent, moveTargetFlash, dynasty, familyIdSet])

  // Redraw loop for animations (pulse effects)
  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      draw()
      animFrame.current = requestAnimationFrame(loop)
    }
    loop()
    return () => { running = false; cancelAnimationFrame(animFrame.current) }
  }, [draw])

  // --- Zoom (mouse wheel) ---
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    // Mouse position relative to container
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    setZoom(prevZoom => {
      const dir = e.deltaY < 0 ? 1 : -1
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + dir * ZOOM_STEP))
      const scale = newZoom / prevZoom

      // Adjust camera so zoom centers on mouse position
      setCamera(prev => ({
        x: mx - scale * (mx - prev.x),
        y: my - scale * (my - prev.y),
      }))
      return newZoom
    })
  }, [])

  // Attach wheel event with passive: false (needed to preventDefault)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Touch support: pinch-to-zoom + drag
  const touchRef = useRef({ dist: 0, zoom: 1, cx: 0, cy: 0 })
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchRef.current = {
        dist: Math.sqrt(dx * dx + dy * dy),
        zoom,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    } else if (e.touches.length === 1) {
      dragStart.current = { x: e.touches[0].clientX - camera.x, y: e.touches[0].clientY - camera.y }
      setDragging(false)
    }
  }, [zoom, camera])

  const handleTouchMove = useCallback((e) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchRef.current.zoom * (dist / touchRef.current.dist)))
      const scale = newZoom / zoom
      const rect = wrapRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = touchRef.current.cx - rect.left
        const cy = touchRef.current.cy - rect.top
        setCamera(prev => ({ x: cx - scale * (cx - prev.x), y: cy - scale * (cy - prev.y) }))
      }
      setZoom(newZoom)
    } else if (e.touches.length === 1 && dragStart.current) {
      const dx = e.touches[0].clientX - dragStart.current.x - camera.x
      const dy = e.touches[0].clientY - dragStart.current.y - camera.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setDragging(true)
      setCamera({ x: e.touches[0].clientX - dragStart.current.x, y: e.touches[0].clientY - dragStart.current.y })
    }
  }, [zoom, camera])

  const handleTouchEnd = useCallback(() => { dragStart.current = null }, [])

  // --- Pan/Drag ---
  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) {
      dragStart.current = { x: e.clientX - camera.x, y: e.clientY - camera.y }
      setDragging(false)
    }
  }, [camera])

  const handleMouseMove = useCallback((e) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x - camera.x
    const dy = e.clientY - dragStart.current.y - camera.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setDragging(true)
    setCamera({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }, [camera])

  const pixelToHexLocal = useCallback((px, py) => {
    const q = (SQRT3 / 3 * px - 1 / 3 * py) / HEX
    const r = (2 / 3 * py) / HEX
    const s = -q - r
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s)
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s)
    if (dq > dr && dq > ds) rq = -rr - rs
    else if (dr > ds) rr = -rq - rs
    return [rq + Math.floor((rr - (rr & 1)) / 2), rr]
  }, [])

  const handleMouseUp = useCallback((e) => {
    if (!dragging && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      // Convert screen coords → canvas coords (accounting for pan + zoom)
      const mx = (e.clientX - rect.left - camera.x) / zoom - PAD
      const my = (e.clientY - rect.top - camera.y) / zoom - PAD
      const [col, row] = pixelToHexLocal(mx, my)

      // Check if clicked on an agent
      const clicked = agents.find(a => a.alive && a.x === col && a.y === row)
      const ownAgent = myAgent ?? agents.find(a => a.alive && a.owner_id === user?.id)

      if (clicked && clicked.id === ownAgent?.id) {
        // Clicked own agent → just select, no move
        setHoveredAgent(clicked)
        onSelectAgent?.(clicked)
      } else if (col >= 0 && row >= 0 && col < gridSize && row < gridSize && isLand(col, row) && ownAgent) {
        // Any land hex (even with other agents) → move command + select if agent there
        setMoveTarget(ownAgent.id, col, row).catch(err => console.error('Move error:', err))
        setMoveTargetFlash({ x: col, y: row, time: Date.now() })
        if (clicked) {
          setHoveredAgent(clicked)
          onSelectAgent?.(clicked)
        } else {
          setHoveredAgent(null)
        }
      } else if (clicked) {
        setHoveredAgent(clicked)
        onSelectAgent?.(clicked)
      }
    }
    dragStart.current = null
  }, [dragging, agents, PAD, onSelectAgent, user, myAgent, gridSize, pixelToHexLocal, camera, zoom])

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

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1a2e] cursor-grab active:cursor-grabbing"
      style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { dragStart.current = null }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          imageRendering: zoom >= 2 ? 'pixelated' : 'auto',
        }}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => {
            const wrap = wrapRef.current
            if (!wrap) return
            const rect = wrap.getBoundingClientRect()
            const cx = rect.width / 2, cy = rect.height / 2
            const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2)
            const scale = newZoom / zoom
            setCamera(prev => ({ x: cx - scale * (cx - prev.x), y: cy - scale * (cy - prev.y) }))
            setZoom(newZoom)
          }}
          className="w-8 h-8 rounded-lg bg-cosmos-900/80 backdrop-blur border border-white/10 text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          title="Hineinzoomen"
        >+</button>
        <button
          onClick={() => {
            const wrap = wrapRef.current
            if (!wrap) return
            const rect = wrap.getBoundingClientRect()
            const cx = rect.width / 2, cy = rect.height / 2
            const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2)
            const scale = newZoom / zoom
            setCamera(prev => ({ x: cx - scale * (cx - prev.x), y: cy - scale * (cy - prev.y) }))
            setZoom(newZoom)
          }}
          className="w-8 h-8 rounded-lg bg-cosmos-900/80 backdrop-blur border border-white/10 text-white text-lg font-bold flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          title="Herauszoomen"
        >−</button>
        <button
          onClick={() => {
            setZoom(1)
            setCamera({ x: 0, y: 0 })
          }}
          className="w-8 h-8 rounded-lg bg-cosmos-900/80 backdrop-blur border border-white/10 text-white text-[10px] font-bold flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          title="Zurücksetzen"
        >1:1</button>
        {/* Locate own agent */}
        {(myAgent ?? agents?.find(a => a.alive && a.owner_id === user?.id)) && (
          <button
            onClick={() => {
              const own = myAgent ?? agents.find(a => a.alive && a.owner_id === user?.id)
              if (!own || !wrapRef.current) return
              const [px, py] = hexToPixelLocal(own.x, own.y)
              const rect = wrapRef.current.getBoundingClientRect()
              const targetZoom = Math.max(zoom, 1.5)
              setCamera({ x: rect.width / 2 - (px + PAD) * targetZoom, y: rect.height / 2 - (py + PAD) * targetZoom })
              setZoom(targetZoom)
            }}
            className="w-8 h-8 rounded-lg bg-cosmos-900/80 backdrop-blur border border-white/10 text-white text-sm flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
            title="Eigenen Agenten finden"
          >📍</button>
        )}
      </div>

      {/* Zoom level indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cosmos-900/60 backdrop-blur border border-white/5 text-[10px] text-gray-500 z-10 pointer-events-none">
        {Math.round(zoom * 100)}%
      </div>

      {/* Hover tooltip */}
      {hoveredAgent && (
        <div className="absolute top-3 left-3 p-3 rounded-xl bg-cosmos-900/90 backdrop-blur border border-white/10 text-xs space-y-1 pointer-events-none z-10 min-w-[180px]">
          <div className="font-display text-white font-bold text-sm">{hoveredAgent.name}</div>
          <div className="flex items-center gap-2 text-gray-400">
            <span style={{ color: ROLE_COLORS[hoveredAgent.role] }}>{hoveredAgent.role ?? 'generalist'}</span>
            {hoveredAgent.veteran && <span className="text-yellow-400">★ Veteran</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t border-white/10">
            <span className="text-gray-500">Energie</span><span className="text-white font-mono">{Math.round(hoveredAgent.energy)}</span>
            <span className="text-gray-500">Material</span><span className="text-white font-mono">{Math.round(hoveredAgent.materials ?? 0)}</span>
            <span className="text-gray-500">Wissen</span><span className="text-white font-mono">{Math.round(hoveredAgent.knowledge ?? 0)}</span>
            <span className="text-gray-500">Reputation</span><span className="text-white font-mono">{(hoveredAgent.reputation ?? 0).toFixed(2)}</span>
            <span className="text-gray-500">Angriff</span><span className="text-white font-mono">{(hoveredAgent.attack ?? 1).toFixed(1)}</span>
            <span className="text-gray-500">Verteidigung</span><span className="text-white font-mono">{(hoveredAgent.defense ?? 1).toFixed(1)}</span>
            <span className="text-gray-500">Kills</span><span className="text-white font-mono">{hoveredAgent.kills ?? 0}</span>
            <span className="text-gray-500">Gen.</span><span className="text-white font-mono">{hoveredAgent.generation}</span>
          </div>
        </div>
      )}

      {/* Legend (bottom-right) */}
      <div className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-cosmos-900/80 backdrop-blur border border-white/10 text-[10px] text-gray-400 z-10">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span>🍎 Nahrung</span><span>💧 Wasser</span>
          <span>🏠 Gebäude</span><span>⛺ Unterschlupf</span>
          <span>🌾 Farm</span><span>☠ Gefahr</span>
          <span>⚓ Hafen</span><span>🦌 Wildtier</span>
        </div>
        <div className="mt-1 pt-1 border-t border-white/10 grid grid-cols-3 gap-1">
          {Object.entries(ROLE_COLORS).map(([r, c]) => (
            <span key={r} style={{ color: c }}>{ROLE_SYMBOLS[r]} {r}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Rounded rect helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
