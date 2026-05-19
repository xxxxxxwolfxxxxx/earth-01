import { useEffect, useState } from 'react'
import { fetchAchievementsCatalog, fetchUnlockedAchievements } from '../../lib/worldService'

const TOOL_DESCRIPTIONS = {
  web_search: 'Web-Suche im Chat: „Such mir Rezepte mit Auberginen."',
  reminder: 'Erinnerungen: „Erinnere mich um 18 Uhr an Yoga."',
  shopping_list: 'Einkaufsliste: „Was hatte ich auf der Liste? Füge Milch hinzu."',
  recipe_helper: 'Rezept-Berater: „Was kann ich aus Linsen, Zwiebeln und Reis kochen?"',
  travel_info: 'Reise-Infos: Routen, Sehenswürdigkeiten, ÖPNV-Auskunft.',
  weather: 'Wettervorhersage für deinen Ort.',
  multi_agent_chat: 'Mehrere Agenten gleichzeitig befragen.',
  image_generate: 'Bild-Generation: „Mal mir einen Sonnenuntergang."',
  family_memory: 'Agent erinnert sich an Personen aus deinem Leben.',
  symptom_tracker: 'Symptome dokumentieren, Muster erkennen.',
  price_compare: 'Preisvergleich für Produkte.',
  project_manager: 'Tasks, Deadlines, Sub-Goals tracken.',
  math_eval: 'Mathe-/Berechnungs-Helfer.',
  security_check: 'Passwort-Stärke, Phishing-Erkennung, 2FA-Tipps.',
  diary: 'Tägliche Einträge, Stimmungs-Tracking.',
  decision_helper: 'Pro/Contra-Listen, Kriterien gewichten.',
  translator: 'Übersetzungen.',
  personality_style: 'Agent entwickelt einzigartigen Schreibstil.',
  email_send: 'Email-Drafts oder Versand mit deinem Resend-Key.',
  autonomous_mode: 'Agent erhält eigene Cron-Jobs, handelt selbständig.',
}

export default function ToolsPanel() {
  const [catalog, setCatalog] = useState([])
  const [unlocked, setUnlocked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAchievementsCatalog(), fetchUnlockedAchievements()])
      .then(([c, u]) => {
        setCatalog(c)
        setUnlocked(u)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500">Lade Tools…</div>

  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id))
  const unlockedAch = catalog.filter((a) => unlockedIds.has(a.id))
  const lockedAch = catalog.filter((a) => !unlockedIds.has(a.id))

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-white mb-2">
          Freigeschaltete Tools ({unlockedAch.length})
        </h3>
        {unlockedAch.length === 0 ? (
          <div className="text-gray-500 text-sm">
            Noch keine Tools freigeschaltet. Spiele um deinen Agenten Fähigkeiten beizubringen.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unlockedAch.map((a) => (
              <ToolCard key={a.id} ach={a} unlocked />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-white mb-2">
          Gesperrt ({lockedAch.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lockedAch.map((a) => (
            <ToolCard key={a.id} ach={a} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ ach, unlocked }) {
  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        unlocked
          ? 'bg-nebula-500/10 border-nebula-500/30'
          : 'bg-white/[0.02] border-white/5 opacity-60'
      }`}
    >
      <div className="text-2xl">{ach.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">
          {ach.name} <span className="text-[10px] text-gray-400">· {ach.tool_id}</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {TOOL_DESCRIPTIONS[ach.tool_id] ?? 'Wird in Phase C verfügbar.'}
        </div>
        <div className="text-[10px] mt-1">
          <span className={`px-1.5 py-0.5 rounded ${
            ach.key_class === 'builtin'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {ach.key_class === 'builtin' ? 'Eingebaut' : 'Erweitert'}
          </span>
        </div>
      </div>
    </div>
  )
}
