import { useEffect, useState } from 'react'
import { fetchFamilyEvents } from '../../lib/worldService'

const TYPE_LABELS = {
  achievement_unlocked: '🏆 Achievement',
  dynasty_succession: '👑 Erbübergang',
  dynasty_childless_restart: '💔 Klon-Restart',
  birth: '👶 Geburt',
  death: '🪦 Tod',
}

export default function ChronicleListPanel() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFamilyEvents(100)
      .then((e) => setEvents(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500">Lade Chronik…</div>
  if (events.length === 0) return <div className="text-gray-500">Noch keine Ereignisse.</div>

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 divide-y divide-white/5">
      {events.map((e) => {
        const d = e.detail ?? {}
        return (
          <div key={e.id} className="px-4 py-3 flex items-start gap-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 w-24 flex-shrink-0">
              Tick {e.tick}
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">
                {TYPE_LABELS[e.event_type] ?? e.event_type}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {detailText(e.event_type, d)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function detailText(type, d) {
  switch (type) {
    case 'achievement_unlocked':
      return `${d.icon ?? ''} ${d.achievement_name ?? d.achievement_id}`
    case 'dynasty_succession':
      return `${d.deceased_display ?? '?'} → ${d.heir_display ?? '?'} (Gen ${d.generation})`
    case 'dynasty_childless_restart':
      return `Verloren: ${d.lost_achievement || '—'}`
    case 'birth':
      return d.name ?? 'unbekannt'
    case 'death':
      return `${d.name ?? '?'} (${d.cause ?? '?'})`
    default:
      return JSON.stringify(d).slice(0, 80)
  }
}
