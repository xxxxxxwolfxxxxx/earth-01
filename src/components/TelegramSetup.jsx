import { useState, useEffect } from 'react'
import { MessageSquare, Link2, Unlink, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { registerTelegram, unregisterTelegram, fetchTelegramStatus } from '../lib/worldService'

export default function TelegramSetup() {
  const [status, setStatus] = useState(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    const s = await fetchTelegramStatus()
    setStatus(s || false)
  }

  async function handleConnect() {
    if (!token.trim()) {
      setError('Bitte Bot-Token eingeben')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await registerTelegram(token.trim())
      setSuccess(`Bot @${result.bot.username} verbunden!`)
      setToken('')
      await loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      await unregisterTelegram()
      setStatus(false)
      setSuccess('Bot getrennt.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === null) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Telegram-Status...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-display text-white text-lg font-bold">Telegram verbinden</h3>
          <p className="text-gray-500 text-sm">Chatte per Telegram mit deinem Agenten</p>
        </div>
      </div>

      {status && status.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm">Verbunden</span>
            <span className="text-gray-500 text-sm ml-1">({status.maskedToken})</span>
          </div>
          {status.chatId ? (
            <p className="text-gray-400 text-xs">Chat aktiv. Schreib deinem Bot in Telegram!</p>
          ) : (
            <p className="text-yellow-400 text-xs">Bot verbunden, aber noch kein Chat gestartet. Sende /start an deinen Bot in Telegram.</p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            Trennen
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showGuide ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Wie erstelle ich einen Telegram-Bot?
          </button>

          {showGuide && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-sm space-y-2">
              <p className="text-gray-300 font-medium">Schritt-für-Schritt:</p>
              <ol className="text-gray-400 space-y-1.5 list-decimal list-inside">
                <li>Öffne Telegram und suche nach <strong className="text-white">@BotFather</strong></li>
                <li>Sende <code className="px-1 py-0.5 bg-white/10 rounded text-xs">/newbot</code></li>
                <li>Wähle einen Namen (z.B. "Mein Earth Agent")</li>
                <li>Wähle einen Username (z.B. <code className="px-1 py-0.5 bg-white/10 rounded text-xs">mein_earth_agent_bot</code>)</li>
                <li>Kopiere den <strong className="text-white">Token</strong> und füge ihn unten ein</li>
              </ol>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-2"
              >
                @BotFather öffnen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => { setToken(e.target.value); setError(null) }}
              placeholder="Bot-Token einfügen..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !token.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Verbinden
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300 text-sm">{success}</span>
        </div>
      )}
    </div>
  )
}
