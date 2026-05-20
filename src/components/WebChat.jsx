import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { fetchAgentMessages, subscribeToMessages, fetchLLMFromProfile } from '../lib/worldService'
import { supabase } from '../lib/supabase'
import { useWorld } from '../contexts/WorldContext'
import { loadLLMSettings, queryLLM } from '../lib/llmAdapters'
import { buildChatPrompt } from '../lib/agentBrain'

// Versucht zuerst das Supabase-Profil (KeySetupPanel / Phase C),
// fällt dann auf localStorage zurück (älterer Browser-LLM-Setup).
async function resolveLLMSettings() {
  const fromProfile = await fetchLLMFromProfile()
  if (fromProfile?.apiKey) {
    return {
      provider: 'openai-compatible',
      baseUrl: fromProfile.baseUrl || 'https://integrate.api.nvidia.com/v1',
      apiKey: fromProfile.apiKey,
      model: fromProfile.model || 'moonshotai/kimi-k2.5',
    }
  }
  return loadLLMSettings()
}

export default function WebChat({ agent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasLLM, setHasLLM] = useState(false)
  const scrollRef = useRef(null)
  const { worldState } = useWorld()

  useEffect(() => {
    resolveLLMSettings().then((s) => setHasLLM(!!s))
  }, [])

  useEffect(() => {
    if (!agent?.id) return

    fetchAgentMessages(agent.id, 30).then((msgs) => {
      setMessages(msgs)
      setLoading(false)
    })

    const unsub = subscribeToMessages(agent.id, (newMsg) => {
      setMessages((prev) => [...prev, newMsg])
    })

    return unsub
  }, [agent?.id])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !agent) return
    const text = input.trim()
    setInput('')
    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const tick = worldState?.tick ?? 0

      // Insert user message
      await supabase.from('agent_messages').insert({
        agent_id: agent.id,
        direction: 'user',
        content: text,
        tick,
      })

      // Set forced_phase to free
      await supabase.from('agents').update({ forced_phase: 'free' }).eq('id', agent.id)

      // Try LLM: profile first, localStorage fallback
      const settings = await resolveLLMSettings()
      if (settings) {
        const { data: longMems } = await supabase
          .from('agent_memory')
          .select('content, importance')
          .eq('agent_id', agent.id)
          .eq('memory_type', 'long')
          .order('importance', { ascending: false })
          .limit(5)

        const { data: userMems } = await supabase
          .from('agent_memory')
          .select('content, importance, category')
          .eq('agent_id', agent.id)
          .eq('memory_type', 'user')
          .order('importance', { ascending: false })
          .limit(10)

        const { data: recent } = await supabase
          .from('agent_messages')
          .select('direction, content')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(10)

        const prompt = buildChatPrompt(
          agent,
          (recent ?? []).reverse(),
          longMems ?? [],
          userMems ?? [],
          worldState
        )

        const response = await queryLLM(prompt, settings)
        const cleanResponse = response.replace(/\[REMEMBER\].*?(?:\[\/REMEMBER\]|$)/s, '').trim()

        await supabase.from('agent_messages').insert({
          agent_id: agent.id,
          direction: 'agent',
          content: cleanResponse,
          tick,
        })
      }
      // If no browser LLM, the message will be answered by Telegram webhook on next message
    } catch (err) {
      console.error('Chat error:', err)
    }
    setSending(false)
  }, [input, sending, agent, worldState])

  if (!agent) return null

  return (
    <div className="flex flex-col h-full min-h-[400px] rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Bot className="w-4 h-4 text-nebula-400" />
        <span className="font-display text-white font-bold text-sm">Chat mit {agent.name}</span>
        {!hasLLM && (
          <span className="text-[10px] text-gray-500 ml-auto">LLM nicht konfiguriert — Antwort via Telegram</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Nachrichten...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            Noch keine Nachrichten. Schreib deinem Agenten!
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id ?? i}
              className={`flex gap-2 ${msg.direction === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.direction !== 'user' && (
                <div className="w-7 h-7 rounded-full bg-nebula-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-nebula-400" />
                </div>
              )}
              <div
                className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.direction === 'user'
                    ? 'bg-nebula-600/30 text-white rounded-br-sm'
                    : 'bg-white/5 text-gray-300 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.direction === 'user' && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage() }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Nachricht an ${agent.name}...`}
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-nebula-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-3 py-2 rounded-lg bg-nebula-600 hover:bg-nebula-500 text-white transition-colors disabled:opacity-40 border-none cursor-pointer flex items-center gap-1"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
