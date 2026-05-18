import { useState, useEffect } from 'react'
import { Cpu, Check, X, Loader2 } from 'lucide-react'
import { loadLLMSettings, saveLLMSettings, clearLLMSettings, testConnection, PROVIDER_PRESETS } from '../lib/llmAdapters'

export default function LLMConfig() {
  const [provider, setProvider] = useState('lmstudio')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const saved = loadLLMSettings()
    if (saved) {
      setProvider(saved.provider || 'lmstudio')
      setBaseUrl(saved.baseUrl || '')
      setApiKey(saved.apiKey || '')
      setModel(saved.model || '')
      setStatus({ ok: true, response: 'Gespeichert' })
    }
  }, [])

  useEffect(() => {
    const preset = PROVIDER_PRESETS[provider]
    if (preset?.baseUrl) setBaseUrl(preset.baseUrl)
  }, [provider])

  async function handleTest() {
    setTesting(true)
    setStatus(null)
    const settings = { provider, baseUrl, apiKey, model }
    const result = await testConnection(settings)
    setStatus(result)
    if (result.ok) saveLLMSettings(settings)
    setTesting(false)
  }

  function handleDisconnect() {
    clearLLMSettings()
    setStatus(null)
    setApiKey('')
    setModel('')
  }

  const preset = PROVIDER_PRESETS[provider]

  return (
    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-nebula-400" />
        <h3 className="font-display text-white font-bold">LLM-Verbindung</h3>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Verbinde dein eigenes LLM, um deinen Agenten intelligentere Entscheidungen treffen zu lassen.
        API-Keys bleiben lokal in deinem Browser.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nebula-500"
          >
            {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:1234"
            className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-nebula-500"
          />
        </div>

        {(preset?.needsKey || provider === 'custom') && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-nebula-500"
            />
          </div>
        )}

        {(preset?.needsModel || provider === 'custom') && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Modell</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="z.B. llama3, gpt-4o-mini"
              className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-nebula-500"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !baseUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-nebula-600 hover:bg-nebula-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {testing ? 'Teste...' : 'Verbinden & Testen'}
          </button>
          {status?.ok && (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-colors"
            >
              Trennen
            </button>
          )}
        </div>

        {status && (
          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${status.ok ? 'bg-life-500/10 text-life-400' : 'bg-danger-500/10 text-danger-400'}`}>
            {status.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {status.ok ? `Verbunden: "${status.response}"` : status.error}
          </div>
        )}
      </div>
    </div>
  )
}
