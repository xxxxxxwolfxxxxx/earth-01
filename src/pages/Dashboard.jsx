import { useState, useEffect, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Users, Heart, Skull, Clock, MapPin, Brain, Zap, Plus, Sparkles, Loader2, Gem, BookOpen, Swords, Star, Pencil, Check, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorld } from '../contexts/WorldContext'
import { fetchMyAgents, submitAgentSuggestion, renameAgent, fetchDynastyState } from '../lib/worldService'
import { getAgentDecision } from '../lib/agentBrain'
import { loadLLMSettings } from '../lib/llmAdapters'
import AchievementGrid from '../components/AchievementGrid'
import LLMConfig from '../components/LLMConfig'
import TelegramSetup from '../components/TelegramSetup'
import WebChat from '../components/WebChat'
import QuestPanel from '../components/QuestPanel'

function AgentCard({ agent, worldState, allAgents, tiles, onSuggestionSent, selected, onSelect, onRenamed }) {
  const [thinking, setThinking] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(agent.name)
  const [saving, setSaving] = useState(false)
  const hasLLM = !!loadLLMSettings()

  const handleRename = async () => {
    if (!editName.trim() || editName.trim() === agent.name) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await renameAgent(agent.id, editName.trim())
      setEditing(false)
      onRenamed?.()
    } catch (err) {
      console.error('Rename error:', err)
    }
    setSaving(false)
  }

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
  const roleLabels = { generalist: 'Generalist', farmer: 'Farmer', builder: 'Baumeister', researcher: 'Forscher', guard: 'Wächter', trader: 'Händler' }
  const roleColors = { generalist: 'text-gray-400', farmer: 'text-lime-400', builder: 'text-purple-400', researcher: 'text-cyan-400', guard: 'text-red-400', trader: 'text-amber-400' }

  return (
    <div
      onClick={() => agent.alive && onSelect?.(agent)}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        agent.alive
          ? selected
            ? 'bg-nebula-600/10 border-nebula-500/40 ring-1 ring-nebula-500/20'
            : 'bg-white/[0.03] border-white/10 hover:border-white/20'
          : 'bg-white/[0.01] border-white/5 opacity-60 cursor-default'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          {editing ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false) }}
                maxLength={30}
                autoFocus
                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm font-display font-bold w-32 focus:outline-none focus:border-nebula-400"
              />
              <button onClick={handleRename} disabled={saving} className="p-1 text-green-400 hover:text-green-300 bg-transparent border-none cursor-pointer">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditing(false); setEditName(agent.name) }} className="p-1 text-gray-500 hover:text-gray-300 bg-transparent border-none cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h3 className="font-display text-white font-bold">{agent.name}</h3>
              {agent.alive && (
                <button
                  onClick={e => { e.stopPropagation(); setEditing(true); setEditName(agent.name) }}
                  className="p-0.5 text-gray-600 hover:text-gray-300 bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Umbenennen"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">Gen. {agent.generation}</span>
            <span className={`text-xs font-medium ${roleColors[agent.role] ?? 'text-gray-400'}`}>
              {roleLabels[agent.role] ?? agent.role ?? 'Generalist'}
            </span>
            {agent.veteran && <Star className="w-3 h-3 text-yellow-400" />}
          </div>
        </div>
        {agent.alive ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 ${phaseColors[agent.day_phase]}`}>
            {phaseLabels[agent.day_phase]}
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-danger-500/10 text-danger-400">
            Tot: {agent.cause_of_death || '?'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Zap className="w-3 h-3 text-energy-400" />
          <span className="text-white font-mono">{Math.round(agent.energy)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Gem className="w-3 h-3 text-orange-400" />
          <span className="text-white font-mono">{Math.round(agent.materials ?? 0)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <BookOpen className="w-3 h-3 text-indigo-400" />
          <span className="text-white font-mono">{Math.round(agent.knowledge ?? 0)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Heart className="w-3 h-3 text-life-400" />
          <span className="text-white font-mono">{(agent.reputation ?? 0).toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Swords className="w-3 h-3 text-red-400" />
          <span className="text-white font-mono">{(agent.attack ?? 1).toFixed(1)}/{(agent.defense ?? 1).toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock className="w-3 h-3 text-star-300" />
          <span className="text-white font-mono">{agent.age}</span>
        </div>
      </div>

      {agent.alive && hasLLM && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <button
            onClick={(e) => { e.stopPropagation(); requestDecision() }}
            disabled={thinking || agent.day_phase === 'sleep'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-nebula-600/20 hover:bg-nebula-600/30 text-nebula-300 text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {thinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {thinking ? 'Denkt...' : 'KI-Entscheidung'}
          </button>
          {lastAction && <span className="text-xs text-gray-500 ml-2">{lastAction}</span>}
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
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [dynasty, setDynasty] = useState(null)

  const loadAgents = useCallback(() => {
    if (!user) return
    fetchMyAgents().then((data) => {
      setMyAgents(data)
      setLoading(false)
      // Auto-select first alive agent
      const alive = data.filter(a => a.alive)
      if (alive.length > 0 && !selectedAgent) {
        setSelectedAgent(alive[0])
      }
    })
  }, [user])

  useEffect(() => { loadAgents() }, [loadAgents])

  // Keep selected agent data fresh from world context
  useEffect(() => {
    if (selectedAgent && worldAgents?.length) {
      const fresh = worldAgents.find(a => a.id === selectedAgent.id)
      if (fresh) setSelectedAgent(fresh)
    }
  }, [worldAgents])

  useEffect(() => {
    fetchDynastyState().then(setDynasty)
  }, [])

  if (authLoading) return <div className="text-center py-32 text-gray-500">Lade...</div>
  if (!user) return <Navigate to="/login" replace />

  const alive = myAgents.filter(a => a.alive)
  const dead = myAgents.filter(a => !a.alive)

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Deine Agenten und Chat</p>
        </div>
        {alive.length < 1 && (
          <Link
            to="/konfigurator"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold text-sm no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Neuer Agent
          </Link>
        )}
      </div>

      {dynasty?.name && (
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
          <div className="text-4xl">{dynasty.emoji}</div>
          <div className="flex-1">
            <div className="text-white text-xl font-display font-bold">
              Linie {dynasty.name}
            </div>
            <div className="text-sm text-gray-400">
              Generation {dynasty.generation}
              {dynasty.startedAt &&
                ` · gegründet ${new Date(dynasty.startedAt).toLocaleDateString('de-DE')}`}
            </div>
          </div>
        </div>
      )}

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
        /* Main layout: Left sidebar (agents + config) | Right chat */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Agents + Settings */}
          <div className="lg:col-span-1 space-y-4">
            {alive.length > 0 && (
              <div>
                <h2 className="font-display text-white text-sm font-bold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-life-400" /> Lebend ({alive.length})
                </h2>
                <div className="space-y-3">
                  {alive.map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      worldState={worldState}
                      allAgents={worldAgents}
                      tiles={tiles}
                      onSuggestionSent={loadAgents}
                      selected={selectedAgent?.id === agent.id}
                      onSelect={setSelectedAgent}
                      onRenamed={loadAgents}
                    />
                  ))}
                </div>
              </div>
            )}

            {dead.length > 0 && (
              <div>
                <h2 className="font-display text-white text-sm font-bold mb-3 flex items-center gap-2">
                  <Skull className="w-4 h-4 text-gray-500" /> Verstorben ({dead.length})
                </h2>
                <div className="space-y-3">
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

            {selectedAgent && <QuestPanel agent={selectedAgent} />}
            <TelegramSetup />
            <LLMConfig />
          </div>

          {/* Right column: Chat */}
          <div className="lg:col-span-2">
            {selectedAgent ? (
              <div className="sticky top-24 h-[calc(100vh-8rem)]">
                <WebChat agent={selectedAgent} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-xl bg-white/[0.02] border border-white/5 text-gray-500 text-sm">
                Wähle einen Agenten zum Chatten
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-10">
        <AchievementGrid />
      </div>
    </div>
  )
}
