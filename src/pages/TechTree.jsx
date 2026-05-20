import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Lock, CheckCircle2, Sparkles, Filter, X } from 'lucide-react'
import { fetchSkills, fetchUserSkills, subscribeUserSkills } from '../lib/skillService'
import { useAuth } from '../contexts/AuthContext'

const PATH_META = {
  hub:        { color: '#a78bfa', label: 'Hub',                 desc: 'Dein Startpunkt' },
  daten:      { color: '#60a5fa', label: 'Daten aus dem Netz',  desc: 'Öffentliche APIs anzapfen' },
  sicherheit: { color: '#f87171', label: 'Sicherheit',          desc: 'Hashes, Passwörter, Leaks' },
  tracking:   { color: '#ec4899', label: 'Mich verstehen',      desc: 'Notizen, Mood, Habits' },
  llm:        { color: '#f59e0b', label: 'Sprachmodelle',       desc: 'Tokens, Prompts, RAG' },
  automation: { color: '#4ade80', label: 'Automation',          desc: 'Cron-Jobs, Reminder' },
  cloud:      { color: '#06b6d4', label: 'Eigene Cloud',        desc: 'Google Drive, GitHub' },
  spielerei:  { color: '#fbbf24', label: 'Werkzeuge',           desc: 'QR, Würfel, Mathe, Zitate' },
  gemeinschaft: { color: '#10b981', label: 'Gemeinschaft',      desc: 'Bot arbeiten · Credits · Mammutaufgaben' },
}

// Layout-Konstanten
const HUB_X = 80
const HUB_Y_TOP = 360
const NODE_W = 200
const NODE_H = 70
const LANE_HEIGHT = 110
const LANE_START_X = 360
const COL_GAP = 230

export default function TechTree() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [skills, setSkills] = useState([])
  const [unlocked, setUnlocked] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(null)
  const [hoveredSkill, setHoveredSkill] = useState(null)

  useEffect(() => {
    Promise.all([fetchSkills(), user ? fetchUserSkills() : []]).then(([s, u]) => {
      setSkills(s)
      setUnlocked(new Set(u.map(x => x.skill_id)))
      setLoading(false)
    })
    if (!user) return
    const unsub = subscribeUserSkills((row) => {
      setUnlocked(prev => new Set([...prev, row.skill_id]))
    })
    return unsub
  }, [user])

  const { hubSkills, lanes, layoutHeight, layoutWidth } = useMemo(() => {
    const hubSk = skills.filter(s => s.path === 'hub')
    const pathOrder = ['daten', 'sicherheit', 'tracking', 'llm', 'automation', 'cloud', 'spielerei', 'gemeinschaft']
    const presentPaths = pathOrder.filter(p => skills.some(s => s.path === p))

    const lanes = presentPaths.map((path, laneIdx) => {
      const laneY = 60 + laneIdx * LANE_HEIGHT
      const pathSkills = skills
        .filter(s => s.path === path)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((s, colIdx) => ({
          ...s,
          _x: LANE_START_X + colIdx * COL_GAP,
          _y: laneY,
        }))
      return { path, meta: PATH_META[path], y: laneY, skills: pathSkills }
    })

    const maxCols = Math.max(0, ...lanes.map(l => l.skills.length))
    const layoutWidth = LANE_START_X + Math.max(1, maxCols) * COL_GAP + 60
    const layoutHeight = 60 + presentPaths.length * LANE_HEIGHT + 40

    return { hubSkills: hubSk, lanes, layoutHeight, layoutWidth }
  }, [skills])

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Tech-Baum…</div>
  }

  function isAvailable(skill) {
    if (unlocked.has(skill.id)) return true
    const reqs = Array.isArray(skill.requires) ? skill.requires : []
    return reqs.every(r => unlocked.has(r))
  }
  function status(skill) {
    if (unlocked.has(skill.id)) return 'done'
    if (isAvailable(skill)) return 'available'
    return 'locked'
  }

  const totalSkills = skills.length
  const unlockedCount = skills.filter(s => unlocked.has(s.id)).length
  const availableCount = skills.filter(s => !unlocked.has(s.id) && isAvailable(s)).length
  const progressPct = totalSkills === 0 ? 0 : Math.round((unlockedCount / totalSkills) * 100)

  return (
    <div className="max-w-[1500px] mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Network className="w-4 h-4" /> Tech-Baum
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Dein Lernpfad</h1>
        <p className="text-gray-400 mt-3 text-sm max-w-xl mx-auto">
          Klick auf eine Fähigkeit, lies das Konzept und probier sie aus. Was du freischaltest,
          versteht dein Bot ab sofort.
        </p>
      </div>

      {/* Progress / Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-3xl mx-auto">
        <StatCard label="Freigeschaltet" value={unlockedCount} total={totalSkills} accent="emerald" />
        <StatCard label="Verfügbar" value={availableCount} accent="blue" />
        <StatCard label="Fortschritt" value={`${progressPct}%`} accent="purple" />
      </div>

      {/* Progress bar */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        <div className="text-xs text-gray-500 flex items-center gap-1 pr-2">
          <Filter className="w-3 h-3" /> Pfad-Filter:
        </div>
        <button
          onClick={() => setActiveFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${
            activeFilter === null
              ? 'bg-white/15 text-white border-white/30'
              : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
          }`}
        >
          Alle anzeigen
        </button>
        {lanes.map(lane => (
          <button
            key={lane.path}
            onClick={() => setActiveFilter(activeFilter === lane.path ? null : lane.path)}
            className={`px-3 py-1.5 rounded-full text-xs border transition flex items-center gap-1.5 ${
              activeFilter === lane.path
                ? 'border-white/30 text-white'
                : 'border-white/10 text-gray-400 hover:text-white'
            }`}
            style={
              activeFilter === lane.path
                ? { background: `${lane.meta.color}22`, borderColor: `${lane.meta.color}66` }
                : {}
            }
          >
            <div className="w-2 h-2 rounded-full" style={{ background: lane.meta.color }} />
            {lane.meta.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative bg-gradient-to-br from-cosmos-900 via-cosmos-800 to-cosmos-900 rounded-3xl border border-white/10 p-2 sm:p-4 overflow-x-auto shadow-2xl shadow-black/40">
        {/* Grid background pattern */}
        <div
          className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <svg
          viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
          className="w-full relative"
          style={{ minWidth: '1100px', height: `${layoutHeight * 0.85}px` }}
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Pulse for available */}
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            {/* Hub gradient */}
            <radialGradient id="hubGradient">
              <stop offset="0%" stopColor="rgba(167,139,250,0.4)" />
              <stop offset="100%" stopColor="rgba(167,139,250,0.05)" />
            </radialGradient>
            {/* Path-Linien-Gradients */}
            {lanes.map(lane => (
              <linearGradient key={`grad-${lane.path}`} id={`pathGrad-${lane.path}`} x1="0%" x2="100%">
                <stop offset="0%" stopColor={lane.meta.color} stopOpacity="0.6" />
                <stop offset="100%" stopColor={lane.meta.color} stopOpacity="0.2" />
              </linearGradient>
            ))}
          </defs>

          {/* Hub-Glow-Aura */}
          <circle cx={HUB_X + NODE_W / 2} cy={HUB_Y_TOP + NODE_H + 30} r="120" fill="url(#hubGradient)" />

          {/* Lane-Labels + Linien */}
          {lanes.map(lane => {
            const dim = activeFilter && activeFilter !== lane.path
            return (
              <g key={lane.path} opacity={dim ? 0.18 : 1} style={{ transition: 'opacity 300ms' }}>
                {/* Lane-Hintergrund */}
                <rect
                  x={LANE_START_X - 30}
                  y={lane.y - 10}
                  width={layoutWidth - LANE_START_X + 10}
                  height={NODE_H + 20}
                  rx="14"
                  fill={lane.meta.color}
                  opacity="0.04"
                />
                {/* Linie vom Hub zur Lane */}
                <path
                  d={`M ${HUB_X + NODE_W} ${HUB_Y_TOP + NODE_H / 2}
                      C ${HUB_X + NODE_W + 60} ${HUB_Y_TOP + NODE_H / 2},
                        ${LANE_START_X - 80} ${lane.y + NODE_H / 2},
                        ${LANE_START_X} ${lane.y + NODE_H / 2}`}
                  stroke={`url(#pathGrad-${lane.path})`}
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="6 4"
                />
                {/* Linien zwischen Skills derselben Lane */}
                {lane.skills.map((s, i) => {
                  if (i === 0) return null
                  const prev = lane.skills[i - 1]
                  return (
                    <line
                      key={`line-${s.id}`}
                      x1={prev._x + NODE_W}
                      y1={prev._y + NODE_H / 2}
                      x2={s._x}
                      y2={s._y + NODE_H / 2}
                      stroke={lane.meta.color}
                      strokeOpacity={unlocked.has(prev.id) ? 0.7 : 0.25}
                      strokeWidth="3"
                    />
                  )
                })}
                {/* Lane-Label (links) */}
                <g transform={`translate(${LANE_START_X - 50}, ${lane.y + NODE_H / 2})`}>
                  <circle r="14" fill={lane.meta.color} opacity="0.15" />
                  <circle r="6" fill={lane.meta.color} />
                </g>
                <text
                  x={LANE_START_X - 35}
                  y={lane.y - 14}
                  fontSize="11"
                  fontWeight="600"
                  fill={lane.meta.color}
                  opacity="0.9"
                >
                  {lane.meta.label.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Hub-Knoten (zentral, vertikal gestapelt) */}
          {hubSkills.map((s, i) => (
            <SkillNode
              key={s.id}
              skill={s}
              x={HUB_X}
              y={HUB_Y_TOP + i * (NODE_H + 10)}
              status={status(s)}
              isHub
              color={PATH_META.hub.color}
              onClick={() => navigate(`/lesson/${s.id}`)}
              onHover={setHoveredSkill}
              dimmed={activeFilter !== null}
            />
          ))}

          {/* Hub-Label */}
          <text
            x={HUB_X + NODE_W / 2}
            y={HUB_Y_TOP - 16}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill={PATH_META.hub.color}
            opacity="0.9"
          >
            ★ HUB — START HIER
          </text>

          {/* Lane-Knoten */}
          {lanes.map(lane => {
            const dim = activeFilter && activeFilter !== lane.path
            return lane.skills.map(s => (
              <SkillNode
                key={s.id}
                skill={s}
                x={s._x}
                y={s._y}
                status={status(s)}
                color={lane.meta.color}
                onClick={() => navigate(`/lesson/${s.id}`)}
                onHover={setHoveredSkill}
                dimmed={dim}
              />
            ))
          })}
        </svg>

        {/* Hover-Tooltip */}
        {hoveredSkill && (
          <div className="absolute top-4 right-4 max-w-xs bg-cosmos-950/95 border border-white/20 rounded-xl p-4 backdrop-blur-md shadow-2xl pointer-events-none z-10">
            <div className="flex items-start gap-3">
              <div className="text-3xl shrink-0">{hoveredSkill.icon}</div>
              <div className="min-w-0">
                <div className="font-display text-white font-bold text-base">{hoveredSkill.name}</div>
                <div className="text-xs mt-1" style={{ color: PATH_META[hoveredSkill.path]?.color }}>
                  {PATH_META[hoveredSkill.path]?.label}
                </div>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-3">{hoveredSkill.description}</p>
                {hoveredSkill.token_cost_estimate && hoveredSkill.token_cost_estimate !== '0' && (
                  <div className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Token-Kosten: {hoveredSkill.token_cost_estimate}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 text-xs max-w-3xl mx-auto">
        <LegendItem dotColor="#4ade80" label="Freigeschaltet" />
        <LegendItem dotColor="#60a5fa" label="Verfügbar" pulse />
        <LegendItem dotColor="#6b7280" label="Gesperrt" />
        <LegendItem dotColor="#a78bfa" label="Hub-Start" />
      </div>

      {/* Help */}
      <div className="mt-6 max-w-2xl mx-auto text-center text-xs text-gray-500">
        Tipp: Beginne mit dem Hub (lila). Danach öffnen sich die ersten Skills der anderen Pfade.
        Jede freigeschaltete Fähigkeit wird zu einem Befehl für deinen Telegram-Bot.
      </div>
    </div>
  )
}

/* ─── Sub-Komponenten ─── */

function StatCard({ label, value, total, accent }) {
  const colors = {
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    blue:    'text-blue-400 border-blue-500/20 bg-blue-500/5',
    purple:  'text-purple-400 border-purple-500/20 bg-purple-500/5',
  }
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-1">
        {value}
        {total !== undefined && <span className="text-sm text-gray-500 font-normal"> / {total}</span>}
      </div>
    </div>
  )
}

function LegendItem({ dotColor, label, pulse }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
      <div className="relative">
        <div className="w-3 h-3 rounded-full" style={{ background: dotColor }} />
        {pulse && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: dotColor, opacity: 0.5 }}
          />
        )}
      </div>
      <span className="text-gray-300">{label}</span>
    </div>
  )
}

function SkillNode({ skill, x, y, status, isHub, color, onClick, onHover, dimmed }) {
  const isDone = status === 'done'
  const isAvail = status === 'available'
  const isLocked = status === 'locked'

  const fill = isDone
    ? `${color}22`
    : isAvail
      ? 'rgba(255,255,255,0.05)'
      : 'rgba(255,255,255,0.02)'

  const stroke = isDone ? color : isAvail ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'
  const strokeWidth = isDone || isAvail ? 2 : 1
  const opacity = dimmed ? 0.3 : isLocked ? 0.55 : 1

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(skill)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: 'pointer', opacity, transition: 'opacity 300ms' }}
    >
      {/* Pulse-Glow für verfügbare */}
      {isAvail && !dimmed && (
        <rect
          x="-3" y="-3"
          width={NODE_W + 6}
          height={NODE_H + 6}
          rx="14"
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity="0.5"
          filter="url(#softGlow)"
        >
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Hauptbox */}
      <rect
        width={NODE_W}
        height={NODE_H}
        rx="12"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={isDone ? 'url(#glow)' : undefined}
      />

      {/* Akzent-Streifen links */}
      <rect width="4" height={NODE_H} rx="2" fill={color} opacity={isLocked ? 0.3 : 1} />

      {/* Icon-Kreis */}
      <circle cx="32" cy={NODE_H / 2} r="18" fill={`${color}22`} stroke={`${color}66`} strokeWidth="1" />
      <text
        x="32"
        y={NODE_H / 2 + 7}
        fontSize="20"
        textAnchor="middle"
      >
        {skill.icon}
      </text>

      {/* Name */}
      <text
        x="58"
        y={NODE_H / 2 - 4}
        fontSize="13"
        fontWeight={isHub ? 700 : 600}
        fill="#fff"
      >
        {skill.name.length > 20 ? skill.name.slice(0, 19) + '…' : skill.name}
      </text>

      {/* Sub-Status */}
      <text
        x="58"
        y={NODE_H / 2 + 12}
        fontSize="10"
        fill={isDone ? color : isLocked ? '#64748b' : '#94a3b8'}
        opacity="0.85"
      >
        {isDone ? '✓ Freigeschaltet' : isAvail ? '→ Verfügbar' : 'Gesperrt'}
      </text>

      {/* Status-Badge rechts */}
      {isDone && (
        <g transform={`translate(${NODE_W - 24}, ${NODE_H / 2 - 8})`}>
          <circle cx="8" cy="8" r="9" fill={color} opacity="0.25" />
          <CheckIcon color={color} />
        </g>
      )}
      {isLocked && (
        <g transform={`translate(${NODE_W - 22}, ${NODE_H / 2 - 8})`}>
          <LockIcon />
        </g>
      )}
    </g>
  )
}

function CheckIcon({ color }) {
  return (
    <path
      d="M 3 8 L 7 12 L 14 4"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function LockIcon() {
  return (
    <g fill="none" stroke="#64748b" strokeWidth="1.5">
      <rect x="2" y="7" width="12" height="9" rx="1.5" />
      <path d="M 4.5 7 V 4 a 3.5 3.5 0 0 1 7 0 V 7" />
    </g>
  )
}
