import { useState } from 'react'
import { Cpu, Zap, Shield, Users, Brain, Eye, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

const PRESETS = [
  {
    name: 'Sammler',
    desc: 'Sucht effizient nach Nahrung und vermeidet Gefahren',
    config: { priority: 'food', social: 'neutral', risk: 'low', memory: true, communication: false },
  },
  {
    name: 'Entdecker',
    desc: 'Erkundet die Welt und nimmt Risiken in Kauf',
    config: { priority: 'explore', social: 'neutral', risk: 'high', memory: true, communication: false },
  },
  {
    name: 'Sozialer',
    desc: 'Bildet Gruppen, teilt Ressourcen und kommuniziert',
    config: { priority: 'food', social: 'cooperative', risk: 'medium', memory: true, communication: true },
  },
  {
    name: 'Stratege',
    desc: 'Nutzt KI um komplexe Entscheidungen zu treffen',
    config: { priority: 'balanced', social: 'selective', risk: 'calculated', memory: true, communication: true, useLLM: true },
  },
]

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
  { id: 'google', name: 'Google', models: ['gemini-2.0-flash', 'gemini-2.5-pro'] },
  { id: 'custom', name: 'Eigener Endpunkt', models: [] },
]

export default function AgentConfigurator() {
  const [config, setConfig] = useState({
    name: '',
    priority: 'food',
    social: 'neutral',
    risk: 'medium',
    memory: true,
    communication: false,
    useLLM: false,
    provider: '',
    apiKey: '',
    model: '',
    customEndpoint: '',
    maxCallsPerHour: 20,
    maxTokensPerCall: 200,
  })
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activePreset, setActivePreset] = useState(null)

  const applyPreset = (preset, idx) => {
    setConfig(prev => ({ ...prev, ...preset.config, name: preset.name }))
    setActivePreset(idx)
  }

  const generatedJSON = JSON.stringify({
    name: config.name || 'Mein Agent',
    behavior: {
      priority: config.priority,
      socialMode: config.social,
      riskTolerance: config.risk,
      useMemory: config.memory,
      communicate: config.communication,
    },
    ...(config.useLLM ? {
      llm: {
        provider: config.provider,
        model: config.model,
        limits: {
          maxCallsPerHour: config.maxCallsPerHour,
          maxTokensPerCall: config.maxTokensPerCall,
        },
      },
    } : {}),
  }, null, 2)

  const copyConfig = () => {
    navigator.clipboard.writeText(generatedJSON)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-white text-lg font-bold mb-4">Schnellstart: Vorlagen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((preset, i) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset, i)}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                activePreset === i
                  ? 'bg-nebula-500/20 border-nebula-400'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="font-display font-bold text-white text-sm">{preset.name}</div>
              <div className="text-xs text-gray-400 mt-1">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name deines Agenten</label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="z.B. Explorer-3000"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-nebula-400 focus:ring-1 focus:ring-nebula-400 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Zap className="inline w-4 h-4 mr-1" /> Priorität
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['food', 'Nahrung'],
                ['explore', 'Erkundung'],
                ['balanced', 'Ausgewogen'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setConfig(prev => ({ ...prev, priority: val }))}
                  className={`py-2 px-3 rounded-lg text-sm border transition cursor-pointer ${
                    config.priority === val
                      ? 'bg-nebula-500/20 border-nebula-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Users className="inline w-4 h-4 mr-1" /> Sozialverhalten
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['cooperative', 'Kooperativ'],
                ['neutral', 'Neutral'],
                ['selective', 'Selektiv'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setConfig(prev => ({ ...prev, social: val }))}
                  className={`py-2 px-3 rounded-lg text-sm border transition cursor-pointer ${
                    config.social === val
                      ? 'bg-nebula-500/20 border-nebula-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Shield className="inline w-4 h-4 mr-1" /> Risikobereitschaft
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['low', 'Niedrig'],
                ['medium', 'Mittel'],
                ['high', 'Hoch'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setConfig(prev => ({ ...prev, risk: val }))}
                  className={`py-2 px-3 rounded-lg text-sm border transition cursor-pointer ${
                    config.risk === val
                      ? 'bg-nebula-500/20 border-nebula-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.memory}
                onChange={e => setConfig(prev => ({ ...prev, memory: e.target.checked }))}
                className="w-4 h-4 accent-nebula-400"
              />
              <span className="text-sm text-gray-300">Gedächtnis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.communication}
                onChange={e => setConfig(prev => ({ ...prev, communication: e.target.checked }))}
                className="w-4 h-4 accent-nebula-400"
              />
              <span className="text-sm text-gray-300">Kommunikation</span>
            </label>
          </div>

          <div className="border-t border-white/10 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useLLM}
                onChange={e => setConfig(prev => ({ ...prev, useLLM: e.target.checked }))}
                className="w-4 h-4 accent-nebula-400"
              />
              <Brain className="w-4 h-4 text-nebula-400" />
              <span className="text-sm font-medium text-gray-300">KI-Gehirn aktivieren (eigener API-Key)</span>
            </label>

            {config.useLLM && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-nebula-500/30">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Anbieter</label>
                  <select
                    value={config.provider}
                    onChange={e => setConfig(prev => ({ ...prev, provider: e.target.value, model: '' }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-nebula-400"
                  >
                    <option value="">Wählen...</option>
                    {PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {config.provider && config.provider !== 'custom' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Modell</label>
                    <select
                      value={config.model}
                      onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-nebula-400"
                    >
                      <option value="">Wählen...</option>
                      {PROVIDERS.find(p => p.id === config.provider)?.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {config.provider === 'custom' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API-Endpunkt</label>
                    <input
                      type="url"
                      value={config.customEndpoint}
                      onChange={e => setConfig(prev => ({ ...prev, customEndpoint: e.target.value }))}
                      placeholder="https://api.example.com/v1/chat"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-nebula-400"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-1">API-Key</label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-nebula-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Wird nur lokal im Browser gespeichert, nie an unseren Server gesendet.</p>
                </div>

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-nebula-400 bg-transparent border-none cursor-pointer hover:text-nebula-300"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Limits konfigurieren
                </button>

                {showAdvanced && (
                  <div className="space-y-3">
                    <div>
                      <label className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Max. Calls/Stunde</span>
                        <span className="text-white font-mono">{config.maxCallsPerHour}</span>
                      </label>
                      <input
                        type="range" min="1" max="100"
                        value={config.maxCallsPerHour}
                        onChange={e => setConfig(prev => ({ ...prev, maxCallsPerHour: Number(e.target.value) }))}
                        className="w-full accent-nebula-400"
                      />
                    </div>
                    <div>
                      <label className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Max. Tokens/Call</span>
                        <span className="text-white font-mono">{config.maxTokensPerCall}</span>
                      </label>
                      <input
                        type="range" min="50" max="1000" step="50"
                        value={config.maxTokensPerCall}
                        onChange={e => setConfig(prev => ({ ...prev, maxTokensPerCall: Number(e.target.value) }))}
                        className="w-full accent-nebula-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="sticky top-20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-white text-lg font-bold m-0">Agent-Konfiguration</h3>
              <button
                onClick={copyConfig}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm border-none cursor-pointer hover:bg-white/20 transition"
              >
                {copied ? <Check className="w-4 h-4 text-life-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
            <pre className="bg-cosmos-800 border border-white/10 rounded-xl p-4 text-sm font-mono text-life-400 overflow-x-auto whitespace-pre-wrap">
              {generatedJSON}
            </pre>

            <div className="mt-4 p-4 rounded-xl bg-nebula-500/10 border border-nebula-500/20">
              <h4 className="font-display text-white text-sm font-bold mb-2">So geht es weiter</h4>
              <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside m-0 p-0">
                <li>Kopiere die Konfiguration oben</li>
                <li>Registriere dich auf Earth 0.1</li>
                <li>Lade deinen Agenten in die Welt</li>
                <li>Beobachte wie er überlebt und sich entwickelt</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
