import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Users, Shield, Eye, Heart, Rocket, Check, Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { spawnAgent } from '../lib/worldService'

const PRESETS = [
  {
    name: 'Sammler',
    desc: 'Fokus auf Nahrung, vermeidet Risiken, kooperiert wenig',
    personality: { priority: 0.8, social_mode: 0.3, risk_tolerance: 0.2, curiosity: 0.3, cooperation: 0.4 },
  },
  {
    name: 'Entdecker',
    desc: 'Hohe Neugier, risikofreudig, erkundet die Welt',
    personality: { priority: 0.3, social_mode: 0.5, risk_tolerance: 0.8, curiosity: 0.9, cooperation: 0.4 },
  },
  {
    name: 'Sozialer',
    desc: 'Bildet Gruppen, teilt Ressourcen, baut Beziehungen auf',
    personality: { priority: 0.5, social_mode: 0.9, risk_tolerance: 0.4, curiosity: 0.5, cooperation: 0.9 },
  },
  {
    name: 'Stratege',
    desc: 'Ausgewogen, berechnet Risiken, plant voraus',
    personality: { priority: 0.6, social_mode: 0.6, risk_tolerance: 0.5, curiosity: 0.6, cooperation: 0.6 },
  },
]

const SLIDERS = [
  { key: 'priority', label: 'Arbeitsfokus', icon: Cpu, low: 'Erkundung', high: 'Überleben' },
  { key: 'social_mode', label: 'Sozialverhalten', icon: Users, low: 'Einzelgänger', high: 'Gesellig' },
  { key: 'risk_tolerance', label: 'Risikobereitschaft', icon: Shield, low: 'Vorsichtig', high: 'Mutig' },
  { key: 'curiosity', label: 'Neugier', icon: Eye, low: 'Fokussiert', high: 'Neugierig' },
  { key: 'cooperation', label: 'Kooperation', icon: Heart, low: 'Egoistisch', high: 'Hilfsbereit' },
]

export default function AgentConfigurator() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState({
    priority: 0.5, social_mode: 0.5, risk_tolerance: 0.5, curiosity: 0.5, cooperation: 0.5,
  })
  const [activePreset, setActivePreset] = useState(null)
  const [spawning, setSpawning] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const applyPreset = (preset, idx) => {
    setPersonality({ ...preset.personality })
    setName(preset.name)
    setActivePreset(idx)
    setError(null)
  }

  const handleSlider = (key, value) => {
    setPersonality(prev => ({ ...prev, [key]: parseFloat(value) }))
    setActivePreset(null)
  }

  const handleSpawn = async () => {
    if (!name.trim()) {
      setError('Dein Agent braucht einen Namen')
      return
    }
    setSpawning(true)
    setError(null)
    setSuccess(null)
    try {
      const agent = await spawnAgent({ name: name.trim(), personality })
      setSuccess(`${agent.name} wurde in die Welt gesetzt! Position: (${agent.x}, ${agent.y})`)
      setName('')
      setActivePreset(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSpawning(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <LogIn className="w-12 h-12 text-nebula-400 mx-auto mb-4" />
        <h3 className="font-display text-white text-xl font-bold mb-2">Anmeldung erforderlich</h3>
        <p className="text-gray-400 mb-6">Um einen Agenten zu erstellen, musst du angemeldet sein.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold hover:shadow-lg hover:shadow-nebula-500/25 transition-all cursor-pointer border-none"
        >
          Jetzt anmelden
        </button>
      </div>
    )
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
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Explorer-3000"
              maxLength={30}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-nebula-400 focus:ring-1 focus:ring-nebula-400 transition"
            />
          </div>

          {SLIDERS.map(({ key, label, icon: Icon, low, high }) => (
            <div key={key}>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-300 mb-2">
                <Icon className="w-4 h-4 text-nebula-400" /> {label}
              </label>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={personality[key]}
                onChange={e => handleSlider(key, e.target.value)}
                className="w-full accent-nebula-400"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{low}</span>
                <span className="text-white font-mono">{personality[key].toFixed(2)}</span>
                <span>{high}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="sticky top-20 space-y-4">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <h3 className="font-display text-white text-lg font-bold mb-4">Vorschau: {name || '???'}</h3>
              <div className="space-y-3">
                {SLIDERS.map(({ key, label, low, high }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{label}</span>
                      <span>{personality[key] > 0.6 ? high : personality[key] < 0.4 ? low : 'Ausgewogen'}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-nebula-600 to-nebula-400 rounded-full transition-all duration-300"
                        style={{ width: `${personality[key] * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-life-500/10 border border-life-500/20 text-life-400 text-sm">
                {success}
              </div>
            )}

            <button
              onClick={handleSpawn}
              disabled={spawning}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-bold text-lg hover:shadow-lg hover:shadow-nebula-500/25 transition-all cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {spawning ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Wird erstellt...</>
              ) : (
                <><Rocket className="w-5 h-5" /> Agent in die Welt setzen</>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Maximal 2 lebende Agenten pro Spieler. Dein Agent startet mit 80 Energie.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
