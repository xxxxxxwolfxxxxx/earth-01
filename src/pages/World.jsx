import { useState } from 'react'
import { Eye } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import { useAuth } from '../contexts/AuthContext'
import WorldCanvas from '../components/WorldCanvas'
import WorldStats from '../components/WorldStats'
import WorldEventFeed from '../components/WorldEventFeed'
import Leaderboard from '../components/Leaderboard'
import TechTreePanel from '../components/TechTreePanel'
import AgentDetailPanel from '../components/AgentDetailPanel'
import CharacterHUD from '../components/CharacterHUD'
import FamilyTicker from '../components/FamilyTicker'
import DeathModal from '../components/DeathModal'

export default function World() {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const { user } = useAuth()
  const { worldState, agents, tiles, events, tech } = useWorld()

  const myAgent = agents?.find((a) => a.alive && a.owner_id === user?.id) ?? null

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-3">
          <Eye className="w-4 h-4" /> Live-Welt
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Die Welt beobachten
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl mx-auto leading-relaxed text-sm">
          Beobachte in Echtzeit, wie Agenten ums Überleben kämpfen, forschen, Allianzen bilden
          und die Welt verändern. Klicke auf einen Agenten für Details.
        </p>
      </div>

      {/* Layout B: Character HUD ganz oben */}
      <CharacterHUD />

      {/* Live Stats Bar */}
      <div className="mb-4">
        <WorldStats worldState={worldState} agents={agents} tiles={tiles} events={events} tech={tech} />
      </div>

      {/* Main Content: Map + Sidebar */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <WorldCanvas onSelectAgent={setSelectedAgent} myAgent={myAgent} />
          {/* Family Ticker unter der Karte */}
          <FamilyTicker limit={5} />
        </div>

        <div className="hidden lg:flex flex-col gap-3 w-80 flex-shrink-0">
          <TechTreePanel tech={tech} />
          <WorldEventFeed events={events} />
          <Leaderboard agents={agents} onSelectAgent={setSelectedAgent} />
        </div>
      </div>

      <div className="lg:hidden mt-4 space-y-3">
        <TechTreePanel tech={tech} />
        <WorldEventFeed events={events} />
        <Leaderboard agents={agents} onSelectAgent={setSelectedAgent} />
      </div>

      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Death modal — globaler Realtime-Trigger */}
      <DeathModal />
    </div>
  )
}
