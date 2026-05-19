import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import { fetchDynastyState } from '../lib/worldService'

export default function DeathModal() {
  const { agents, events } = useWorld()
  const [dynasty, setDynasty] = useState(null)
  const [lastSeenMainId, setLastSeenMainId] = useState(null)
  const [modalState, setModalState] = useState(null)
  // modalState shape: { deceased, heir, cause, isClone, generation, lostAchievement }

  // Reload dynasty on mount and whenever the main agent might have changed.
  useEffect(() => {
    fetchDynastyState().then((d) => {
      setDynasty(d)
      setLastSeenMainId(d?.mainAgentId ?? null)
    })
  }, [])

  // When events stream brings a dynasty event for this user, refresh dynasty + open modal.
  useEffect(() => {
    if (!events || events.length === 0) return
    const newest = events[0]
    if (
      newest.event_type !== 'dynasty_succession' &&
      newest.event_type !== 'dynasty_childless_restart'
    ) return
    fetchDynastyState().then((nextDyn) => {
      setDynasty(nextDyn)
      // Build modal content from event detail
      const d = newest.detail ?? {}
      const deceasedAgent = agents?.find((a) => a.id === d.deceased_id)
      const heirAgent = agents?.find((a) => a.id === d.heir_id || a.id === d.clone_id)
      setModalState({
        deceased: deceasedAgent || { display_name: d.deceased_display || 'Hauptchar' },
        heir: heirAgent || (d.heir_display ? { display_name: d.heir_display } : null),
        cause: d.cause ?? 'unknown',
        isClone: newest.event_type === 'dynasty_childless_restart',
        generation: d.generation ?? 1,
        lostAchievement: d.lost_achievement ?? null,
      })
      setLastSeenMainId(nextDyn?.mainAgentId ?? null)
    })
  }, [events?.[0]?.id])

  if (!modalState) return null

  const { deceased, heir, cause, isClone, generation, lostAchievement } = modalState

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative max-w-lg w-full bg-cosmos-900 border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => setModalState(null)}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-6xl mb-3">{isClone ? '💀' : '💔'}</div>
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            {deceased.display_name ?? 'Hauptcharakter'} ist gestorben
          </h2>
          <div className="text-sm text-gray-400 mb-5">
            Todesursache: {cause}
          </div>

          {isClone ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 text-left">
              <div className="font-semibold text-red-300 mb-1">Familie ausgestorben</div>
              <div className="text-sm text-gray-300">
                Ein Klon-Nachfolger startet erneut.
              </div>
              {lostAchievement && (
                <div className="text-sm text-amber-300 mt-2">
                  Verlust: {lostAchievement}
                </div>
              )}
            </div>
          ) : heir ? (
            <div className="bg-life-500/10 border border-life-500/30 rounded-xl p-4 mb-5 text-left">
              <div className="font-semibold text-life-300 mb-1">
                Nachfolge gefunden
              </div>
              <div className="text-base text-white">
                {heir.display_name ?? 'Ein Erbe'}
              </div>
              <div className="text-sm text-gray-400">
                Führt die Linie als Generation {generation} fort.
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setModalState(null)}
            className="px-6 py-2 bg-nebula-500 hover:bg-nebula-400 text-white rounded-lg transition"
          >
            Übernahme bestätigen
          </button>
        </div>
      </div>
    </div>
  )
}
