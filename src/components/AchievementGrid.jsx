import { useEffect, useState } from 'react'
import { fetchAchievementsCatalog, fetchUnlockedAchievements } from '../lib/worldService'

const TIER_LABELS = {
  1: 'Tier 1 — Anfang',
  2: 'Tier 2 — Aufstieg',
  3: 'Tier 3 — Meister',
  4: 'Tier 4 — Meta',
}
const TIER_COLORS = {
  1: 'border-l-green-400',
  2: 'border-l-blue-400',
  3: 'border-l-amber-400',
  4: 'border-l-pink-400',
}

export default function AchievementGrid() {
  const [catalog, setCatalog] = useState([])
  const [unlocked, setUnlocked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [c, u] = await Promise.all([
          fetchAchievementsCatalog(),
          fetchUnlockedAchievements(),
        ])
        setCatalog(c)
        setUnlocked(u)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-gray-500">Lade Achievements…</div>

  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id))
  const byTier = { 1: [], 2: [], 3: [], 4: [] }
  for (const a of catalog) byTier[a.tier]?.push(a)

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl font-bold text-white">
          Achievements
        </h3>
        <div className="text-sm text-gray-400">
          {unlocked.length}/{catalog.length} freigeschaltet
        </div>
      </div>

      {[1, 2, 3, 4].map((tier) => (
        <div
          key={tier}
          className={`bg-white/[0.03] border-l-4 ${TIER_COLORS[tier]} border-y border-r border-white/5 rounded-lg p-4`}
        >
          <div className="text-white font-semibold text-sm mb-3">
            {TIER_LABELS[tier]}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byTier[tier].map((ach) => {
              const isUnlocked = unlockedIds.has(ach.id)
              return (
                <div
                  key={ach.id}
                  className={`flex gap-3 p-3 rounded-lg border ${
                    isUnlocked
                      ? 'bg-nebula-500/10 border-nebula-500/30'
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="text-2xl">{ach.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {ach.name}
                    </div>
                    <div className="text-xs text-gray-400 mb-1">
                      {ach.description}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${
                        ach.key_class === 'builtin'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {ach.key_class === 'builtin' ? 'Eingebaut' : 'Erweitert'}
                      </span>
                      <span className="text-gray-500">
                        Tool: <code className="text-gray-400">{ach.tool_id}</code>
                      </span>
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
