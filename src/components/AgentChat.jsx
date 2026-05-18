import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Loader2, User, Bot } from 'lucide-react'
import { fetchAgentMessages, subscribeToMessages } from '../lib/worldService'

export default function AgentChat({ agentId, agentName }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!agentId) return

    let unsubscribe = null

    async function load() {
      const msgs = await fetchAgentMessages(agentId)
      setMessages(msgs)
      setLoading(false)

      unsubscribe = subscribeToMessages(agentId, (newMsg) => {
        setMessages((prev) => [...prev, newMsg])
      })
    }

    load()
    return () => { if (unsubscribe) unsubscribe() }
  }, [agentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Lade Chat...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Noch keine Nachrichten.</p>
        <p className="text-gray-600 text-xs mt-1">Schreib deinem Agenten per Telegram!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto p-4 rounded-xl bg-black/20">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-2 ${msg.direction === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.direction === 'agent' && (
            <div className="w-7 h-7 rounded-full bg-nebula-500/20 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-nebula-400" />
            </div>
          )}
          <div
            className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
              msg.direction === 'user'
                ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100'
                : 'bg-white/5 border border-white/10 text-gray-300'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <span className="text-[10px] text-gray-600 mt-1 block">
              {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {msg.direction === 'user' && (
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-1">
              <User className="w-4 h-4 text-blue-400" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
