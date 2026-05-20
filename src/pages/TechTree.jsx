import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network } from 'lucide-react'
import { fetchSkills, fetchUserSkills, subscribeUserSkills } from '../lib/skillService'
import { useAuth } from '../contexts/AuthContext'

const PATH_COLORS = {
  hub: '#a78bfa',
  daten: '#60a5fa',
  sicherheit: '#f87171',
  tracking: '#a78bfa',
  llm: '#f59e0b',
  automation: '#4ade80',
  cloud: '#06b6d4',
  spielerei: '#ec4899',
}

const PATH_LABELS = {
  hub: 'Hub',
  daten: 'Daten aus dem Netz',
  sicherheit: 'Sicherheit',
  tracking: 'Mich verstehen',
  llm: 'Sprachmodelle',
  automation: 'Automation',
  cloud: 'Eigene Cloud',
  spielerei: 'Werkzeuge',
}

const NODE_W = 130
const NODE_H = 34

export default function TechTree() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [skills, setSkills] = useState([])
  const [unlocked, setUnlocked] = useState(new Set())
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Tech-Baum…</div>
  }

  const hubSkills = skills.filter(s => s.path === 'hub')
  const paths = ['daten','sicherheit','tracking','llm','automation','cloud','spielerei'].filter(p => skills.some(s => s.path === p))

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

  const hubX = 60
  const hubY = 350
  const skillsByPath = Object.fromEntries(paths.map(p => [p, skills.filter(s => s.path === p)]))

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Network className="w-4 h-4" /> Tech-Baum
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Dein Lernpfad</h1>
        <p className="text-gray-400 mt-3 text-sm">
          {unlocked.size} von {skills.length} Fähigkeiten freigeschaltet. Klick einen Knoten an und lerne ihn.
        </p>
      </div>

      <div className="bg-gradient-to-b from-cosmos-900 to-cosmos-800 rounded-2xl border border-white/10 p-4 overflow-x-auto">
        <svg viewBox="0 0 1250 680" className="w-full min-w-[1200px] h-[680px]" style={{ display: 'block' }}>
          {/* Pfad-Bahnen */}
          {paths.map(p => {
            const sk = skillsByPath[p]
            if (sk.length === 0) return null
            const color = PATH_COLORS[p]
            let d = `M ${hubX + NODE_W} ${hubY + NODE_H/2} `
            sk.forEach((s, i) => {
              const tx = s.display_x + NODE_W/2
              const ty = s.display_y + NODE_H/2
              const prev = i === 0 ? { x: hubX + NODE_W, y: hubY + NODE_H/2 } : { x: sk[i-1].display_x + NODE_W/2, y: sk[i-1].display_y + NODE_H/2 }
              const midX = (prev.x + tx) / 2
              d += `C ${midX} ${prev.y} ${midX} ${ty} ${tx} ${ty} `
            })
            return <path key={p} d={d} stroke={color} strokeWidth="3" fill="none" opacity="0.3" />
          })}

          {/* Hub-Knoten */}
          {hubSkills.map(s => (
            <SkillNode
              key={s.id}
              skill={s}
              status={status(s)}
              isHub
              onClick={() => navigate(`/lesson/${s.id}`)}
            />
          ))}
          {/* Pfad-Knoten */}
          {paths.flatMap(p => skillsByPath[p]).map(s => (
            <SkillNode
              key={s.id}
              skill={s}
              status={status(s)}
              onClick={() => navigate(`/lesson/${s.id}`)}
            />
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
        {paths.map(p => (
          <div key={p} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
            <div className="w-3 h-3 rounded-full" style={{ background: PATH_COLORS[p] }} />
            <span className="text-gray-300">{PATH_LABELS[p]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillNode({ skill, status, isHub, onClick }) {
  const x = isHub ? 60 : skill.display_x
  const y = skill.display_y
  const fillByStatus = {
    done: 'rgba(74,222,128,0.18)',
    available: 'rgba(255,255,255,0.06)',
    locked: 'rgba(255,255,255,0.03)',
  }
  const strokeByStatus = {
    done: 'rgba(74,222,128,0.55)',
    available: 'rgba(255,255,255,0.22)',
    locked: 'rgba(255,255,255,0.12)',
  }
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: status === 'locked' ? 0.5 : 1 }}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8} ry={8}
        fill={isHub ? 'rgba(167,139,250,0.22)' : fillByStatus[status]}
        stroke={isHub ? 'rgba(167,139,250,0.55)' : strokeByStatus[status]}
        strokeWidth="1"
      />
      <text x={14} y={NODE_H/2 + 6} fontSize="16">{skill.icon}</text>
      <text x={38} y={NODE_H/2 + 5} fontSize="12" fill="#fff" fontWeight={isHub ? 700 : 500}>
        {skill.name.length > 18 ? skill.name.slice(0, 17) + '…' : skill.name}
      </text>
    </g>
  )
}
