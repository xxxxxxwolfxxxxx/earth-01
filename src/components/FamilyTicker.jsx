import { useEffect, useState } from 'react'
import { Activity, ChevronRight } from 'lucide-react'
import { fetchFamilyEvents } from '../lib/worldService'
import { useWorld } from '../contexts/WorldContext'

const EVENT_ICONS = {
  achievement_unlocked: '🏆',
  dynasty_succession: '👑',
  dynasty_childless_restart: '💔',
  birth: '👶',
  death: '🪦',
  build: '🏗️',
  trade: '🤝',
  combat: '⚔️',
  hunt: '🏹',
  tech_discovered: '📚',
  alliance_formed: '🛡️',
}

function describeEvent(e) {
  const d = e.detail ?? {}
  switch (e.event_type) {
    case 'achievement_unlocked':
      return `${d.icon ?? '🏆'} Achievement freigeschaltet: ${d.achievement_name ?? d.achievement_id}`
    case 'dynasty_succession':
      return `${d.deceased_display ?? 'Hauptchar'} ist gestorben (${d.cause}). ${d.heir_display ?? 'Erbe'} (Gen ${d.generation}) übernimmt.`
    case 'dynasty_childless_restart':
      return `Familie ausgestorben (${d.cause}). Verloren: ${d.lost_achievement || '—'}.`
    case 'birth':
      return `Kind geboren${d.name ? ` (${d.name})` : ''}`
    case 'death':
      return `${d.name ?? 'Ein Agent'} ist gestorben (${d.cause ?? '?'})`
    default:
      return e.event_type
  }
}

export default function FamilyTicker({ limit = 5 }) {
  const { events: liveEvents } = useWorld()
  const [history, setHistory] = useState([])
  const [open, setOpen] = useState(false)

  // Initial: 30 events laden
  useEffect(() => {
    fetchFamilyEvents(30).then(setHistory)
  }, [])

  // Realtime: bei jedem neuen Event in liveEvents reloaden (einfach, klein)
  useEffect(() => {
    if (!liveEvents || liveEvents.length === 0) return
    fetchFamilyEvents(30).then(setHistory)
  }, [liveEvents?.[0]?.id])

  if (!history || history.length === 0) {
    return null
  }

  const visible = open ? history : history.slice(0, limit)

  return (
    <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="px-4 py-2 flex items-center gap-2 text-xs uppercase text-gray-400">
        <Activity className="w-3.5 h-3.5" /> Lebenslauf der Familie
        <span className="ml-auto text-[10px]">{history.length} Ereignisse</span>
      </div>
      <div className="divide-y divide-white/5">
        {visible.map((e) => (
          <div key={e.id} className="px-4 py-2 flex items-start gap-3 text-sm">
            <div className="text-lg leading-none mt-0.5 flex-shrink-0">
              {EVENT_ICONS[e.event_type] ?? '•'}
            </div>
            <div className="flex-1 text-gray-200">
              {describeEvent(e)}
            </div>
            <div className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">
              Tick {e.tick ?? '?'}
            </div>
          </div>
        ))}
      </div>
      {history.length > limit && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-4 py-2 text-xs text-nebula-400 hover:text-nebula-300 flex items-center justify-center gap-1 border-t border-white/5"
        >
          {open ? 'Weniger zeigen' : `Alle ${history.length} zeigen`}
          <ChevronRight className={`w-3 h-3 transition ${open ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  )
}
