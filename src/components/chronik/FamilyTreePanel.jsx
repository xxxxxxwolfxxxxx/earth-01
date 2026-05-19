import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchDynastyState } from '../../lib/worldService'
import { emojiForAgent } from '../../lib/familyUtils'

export default function FamilyTreePanel() {
  const { user } = useAuth()
  const [allAgents, setAllAgents] = useState([])
  const [dynasty, setDynasty] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const [{ data: agents }, dyn] = await Promise.all([
        supabase.from('agents').select('*').eq('owner_id', user.id),
        fetchDynastyState(),
      ])
      if (cancelled) return
      setAllAgents(agents ?? [])
      setDynasty(dyn)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  const byGen = useMemo(() => {
    const map = new Map()
    for (const a of allAgents) {
      const g = a.generation ?? 0
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(a)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [allAgents])

  if (loading) return <div className="text-gray-500">Lade Stammbaum…</div>
  if (allAgents.length === 0) {
    return <div className="text-gray-500">Noch keine Agenten in dieser Linie.</div>
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Linie {dynasty?.emoji} {dynasty?.name} · {allAgents.length} Mitglieder über {byGen.length} Generationen
      </div>
      {byGen.map(([gen, members]) => (
        <div key={gen} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-nebula-400 mb-3">
            Generation {gen}
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map((a) => {
              const isMain = a.id === dynasty?.mainAgentId
              const emoji = isMain ? (dynasty?.emoji ?? '👑') : emojiForAgent(a)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    isMain
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : a.alive
                        ? 'bg-white/[0.04] border-white/10'
                        : 'bg-white/[0.02] border-white/5 opacity-50'
                  }`}
                >
                  <div className="text-xl">{emoji}</div>
                  <div className="text-sm">
                    <div className="text-white font-medium">
                      {a.display_name ?? a.name}
                      {!a.alive && ' †'}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {a.alive ? `Energie ${Math.round(a.energy)}` : `Tod: ${a.cause_of_death ?? '?'}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
