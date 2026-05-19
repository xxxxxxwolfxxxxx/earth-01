import { useEffect, useState } from 'react'
import { Heart, Clock, Users, Trophy } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import {
  fetchDynastyState,
  fetchUnlockedAchievements,
  fetchAchievementsCatalog,
} from '../lib/worldService'
import { descendantsOf } from '../lib/familyUtils'

export default function CharacterHUD() {
  const { agents } = useWorld()
  const [dynasty, setDynasty] = useState(null)
  const [unlocked, setUnlocked] = useState([])
  const [totalAchievements, setTotalAchievements] = useState(20)

  useEffect(() => {
    (async () => {
      const [d, u, c] = await Promise.all([
        fetchDynastyState(),
        fetchUnlockedAchievements(),
        fetchAchievementsCatalog(),
      ])
      setDynasty(d)
      setUnlocked(u)
      setTotalAchievements(c.length || 20)
    })()
  }, [])

  if (!dynasty?.name || !dynasty?.mainAgentId) {
    return null
  }

  const mainAgent = agents?.find((a) => a.id === dynasty.mainAgentId)
  if (!mainAgent) {
    return (
      <div className="mb-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-gray-400 text-sm">
        Hauptcharakter wird geladen…
      </div>
    )
  }

  const energy = Math.round(mainAgent.energy ?? 0)
  const ageRemaining = Math.max(0, (mainAgent.max_age ?? 1) - (mainAgent.age ?? 0))
  const ageProgress = Math.min(1, (mainAgent.age ?? 0) / (mainAgent.max_age ?? 1))
  const familySize = descendantsOf(mainAgent.id, agents ?? []).size
  const displayName = mainAgent.display_name || dynasty.name

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-nebula-500/10 via-white/[0.03] to-life-500/10 border border-white/10 flex flex-wrap items-center gap-3">
      <div className="text-3xl sm:text-4xl flex-shrink-0">
        {dynasty.emoji ?? '👑'}
      </div>
      <div className="flex-1 min-w-[140px]">
        <div className="text-white font-display font-bold text-base sm:text-lg leading-tight">
          {displayName}
        </div>
        <div className="text-xs text-gray-400">
          Generation {dynasty.generation}
        </div>
      </div>

      <Stat icon={<Heart className="w-4 h-4 text-red-400" />} label="Energie" value={`${energy}/100`} />

      <div className="flex-1 min-w-[120px]">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
          <Clock className="w-3.5 h-3.5" /> Lebenszeit
        </div>
        <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              ageProgress < 0.5 ? 'bg-green-400' : ageProgress < 0.85 ? 'bg-yellow-400' : 'bg-red-500'
            }`}
            style={{ width: `${ageProgress * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          noch {ageRemaining} Ticks
        </div>
      </div>

      <Stat icon={<Users className="w-4 h-4 text-blue-400" />} label="Familie" value={familySize} />
      <Stat icon={<Trophy className="w-4 h-4 text-amber-400" />} label="Erfolge" value={`${unlocked.length}/${totalAchievements}`} />
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-start min-w-[64px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
        {icon} {label}
      </div>
      <div className="text-white font-semibold text-sm">{value}</div>
    </div>
  )
}
