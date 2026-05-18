import { useState, useEffect, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Users, Heart, Skull, Clock, MapPin, Brain, Zap, Plus, Sparkles, Loader2, MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorld } from '../contexts/WorldContext'
import { fetchMyAgents, submitAgentSuggestion } from '../lib/worldService'
import { getAgentDecision } from '../lib/agentBrain'
import { loadLLMSettings } from '../lib/llmAdapters'
import LLMConfig from '../components/LLMConfig'
import TelegramSetup from '../components/TelegramSetup'
import AgentChat from '../components/AgentChat'

function AgentCard({ agent, worldState, allAgents, tiles, onSuggestionSent }) {
  const [thinking, setThinking] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const hasLLM = !!loadLLMSettings()

  const requestDecision = useCallback(async () => {
    if (!worldState || thinking) return
    setThinking(true)
    setLastAction(null)
    try {
      const decision = await getAgentDecision(agent, worldState, allAgents, tiles)
      if (decision) {
        await submitAgentSuggestion(agent.id, decision)
        setLastAction(decision.action)
        onSuggestionSent?.()
      } else {
        setLastAction('(keine Antwort)')
      }
    } catch (err) {
      setLastAction(`Fehler: ${err.message}`)
    }
    setThinking(false)
  }, [agent, worldState, allAgents, tiles, thinking, onSuggestionSent])

  const phaseLabels = { work: 'Arbeitet', free: 'Freizeit', sleep: 'Schläft' }
  const phaseColors = { work: 'text-energy-400', free: 'text-life-400', sleep: 'text-blue-400' }

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      agent.alive
        ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
        : 'bg-white/[0.01] border-white/5 opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-white font-bold text-lg">{agent.name}</h3>
          <span className="text-xs text-gray-500">Gen. {agent.generation}</span>
        </div>
        {agent.alive ? (
          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-white/5 ${phaseColors[agent.day_phase]}`}>
            {phaseLabels[agent.day_phase]}
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-danger-500/10 text-danger-400">
            Tot: {agent.cause_of_death || 'unbekannt'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Zap className="w-4 h-4 text-energy-400" />
          <span>Energie: <span className="text-white font-mono">{Math.round(agent.energy)}</span></span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4 text-star-300" />
          <span>Alter: <span className="text-white font-mono">{agent.age}</span> Ticks</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4 text-nebula-400" />
          <span>Pos: <span className="text-white font-mono">({agent.x}, {agent.y})</span></span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Heart className="w-4 h-4 text-life-400" />
          <span>Rep: <span className="text-white font-mono">{agent.reputation.toFixed(2)}</span></span>
        </div>
      </div>

      {agent.imprisoned_until && (
        <div className="mt-3 p-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
          Im Gefängnis bis Tick {agent.imprisoned_until}
        </div>
      )}

      {agent.alive && hasLLM && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <button
            onClick={requestDecision}
            disabled={thinking || agent.day_phase === 'sleep'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nebula-600/20 hover:bg-nebula-600/30 text-nebula-300 text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {thinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {thinking ? 'Denkt nach...' : 'KI-Entscheidung'}
          </button>
          {lastAction && (
            <span className="text-xs text-gray-500 ml-2">{lastAction}</span>
          )}
        </div>
      )}

      {agent.alive && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            {showChat ? 'Chat ausblenden' : 'Chat anzeigen'}
          </button>
          {showChat && (
            <div className="mt-3">
              <AgentChat agentId={agent.id} agentName={agent.name} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { worldState, agents: worldAgents, tiles } = useWorld()
  const [myAgents, setMyAgents] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAgents = useCallback(() => {
    if (!user) return
    fetchMyAgents().then((data) => {
      setMyAgents(data)
      setLoading(false)
    })
  }, [user])

  useEffect(() => { loadAgents() }, [loadAgents])

  if (authLoading) return <div className="text-center py-32 text-gray-500">Lade...</div>
  if (!user) return <Navigate to="/login" replace />

  const alive = myAgents.filter(a => a.alive)
  const dead = myAgents.filter(a => !a.alive)

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Meine Agenten</h1>
          <p className="text-gray-400 mt-1">Verwalte deine Agenten in der Earth 0.1 Welt</p>
        </div>
        {alive.length < 2 && (
          <Link
            to="/konfigurator"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold text-sm no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Neuer Agent
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Lade Agenten...</div>
      ) : myAgents.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="font-display text-white text-xl font-bold mb-2">Noch keine Agenten</h3>
          <p className="text-gray-400 mb-6">Erstelle deinen ersten Agenten und setze ihn in die Welt!</p>
          <Link
            to="/konfigurator"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition-all"
          >
            <Plus className="w-5 h-5" /> Ersten Agenten erstellen
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {alive.length > 0 && (
            <div>
              <h2 className="font-display text-white text-lg font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-life-400" /> Lebend ({alive.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alive.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    worldState={worldState}
                    allAgents={worldAgents}
                    tiles={tiles}
                    onSuggestionSent={loadAgents}
                  />
                ))}
              </div>
            </div>
          )}

          {dead.length > 0 && (
            <div>
              <h2 className="font-display text-white text-lg font-bold mb-4 flex items-center gap-2">
                <Skull className="w-5 h-5 text-gray-500" /> Verstorben ({dead.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dead.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    worldState={worldState}
                    allAgents={worldAgents}
                    tiles={tiles}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <TelegramSetup />
      </div>

      <div className="mt-8">
        <LLMConfig />
      </div>
    </div>
  )
}
