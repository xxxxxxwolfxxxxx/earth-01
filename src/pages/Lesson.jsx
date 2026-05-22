import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Loader2, Sparkles, AlertTriangle, Key as KeyIcon,
  Lock, Send, BookOpen, Zap, ArrowRight, Copy, ExternalLink,
} from 'lucide-react'
import {
  fetchSkill, fetchSkills, fetchUserSkills, startLesson, advanceLesson,
  markSkillUnlocked, subscribeUserSkills,
} from '../lib/skillService'
import { fetchUserKeys, saveUserKey, testKey, callTelegramAction, SERVICE_CATALOG } from '../lib/keyService'
import { TermText } from '../components/MiniWiki'
import { BOT_TEXT } from '../lib/botMessages'
import { useAuth } from '../contexts/AuthContext'

const PATH_META = {
  hub:        { color: '#a78bfa', label: 'Hub' },
  daten:      { color: '#60a5fa', label: 'Daten aus dem Netz' },
  sicherheit: { color: '#f87171', label: 'Sicherheit' },
  tracking:   { color: '#ec4899', label: 'Mich verstehen' },
  llm:        { color: '#f59e0b', label: 'Sprachmodelle' },
  automation: { color: '#4ade80', label: 'Automation' },
  cloud:      { color: '#06b6d4', label: 'Eigene Cloud' },
  spielerei:  { color: '#fbbf24', label: 'Werkzeuge' },
  gemeinschaft: { color: '#10b981', label: 'Gemeinschaft' },
}

const SKILL_TYPE_LABEL = {
  script: 'Skript',
  config: 'Setup',
  llm:    'Sprachmodell',
}

const VERIFICATION_LABEL = {
  action:  { icon: Send,    label: 'Per Bot probieren', classes: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  browser: { icon: Sparkles, label: 'Direkt im Browser', classes: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  konfig:  { icon: KeyIcon,  label: 'Einmaliges Setup',  classes: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
}

// Auto-Detector: für konfig-Skills automatisch erkennen, ob das Setup schon
// gemacht wurde — anhand bereits gespeicherter Profil-/Key-Daten.
// Kein „Erledigt"-Button-Klick mehr nötig.
export function detectKonfigDone(skillId, keys) {
  switch (skillId) {
    case 'api_keys':       return !!keys?.llm_api_key
    case 'telegram':       return !!keys?.telegram_bot_token
    case 'gdrive_connect': return keys?.cloud_provider === 'gdrive'
    case 'gist_connect':   return keys?.cloud_provider === 'gist'
    case 'embed_setup':    return !!keys?.huggingface_key && !!keys?.cloud_provider
    default:               return false
  }
}

const EXAMPLES = {
  weather:     ['/wetter Berlin', 'wie ist das wetter in Hamburg'],
  web_search:  ['/suche Quantencomputer', 'finde Vegane Rezepte'],
  wikipedia:   ['/wiki Photosynthese', 'was ist Quantenphysik'],
  currency:    ['wie viel sind 50 USD in EUR', '/kurs USD EUR'],
  countries:   ['/land Frankreich', 'info zu Japan', 'hauptstadt von Australien'],
  notes:       ['notiz: Milch kaufen', '/notiz Bürotermin morgen'],
  mood:        ['stimmung: 4', '/stimmung 3'],
  habits:      ['habit: meditiert', 'heute Sport gemacht'],
  reminder:    ['in 30 min erinnere mich an Yoga', 'in 2 stunden erinnere mich an den Kuchen'],
  pomodoro:    ['/pomodoro'],
  joke_quote:  ['/witz', '/zitat'],
  rss:         ['/rss https://www.tagesschau.de/xml/rss2', '/feeds', '/unfeed 1'],
  image_gen:   ['/bild ein Astronaut auf einem Skateboard', '/bild gemütliche Lesecke bei Kerzenlicht'],
  voice_out:   ['/sage Hallo, schön von dir zu hören', '/voice Guten Morgen!'],
  mail_send:   ['/mail an mich@example.de: Nicht den Termin vergessen'],
  chat:        ['/chat Erklär mir wie ein Akku funktioniert', '/chat Gib mir 3 Ideen fürs Abendessen'],
  ask_memory:  ['/frag Was hab ich über Urlaub notiert?'],
  quota_check: ['/quota'],
  teamwork:    ['/arbeiten', '/heim', '/credits'],
  dice:        ['/würfel', '/münze'],
  qr_code:     ['/qr https://earth-01.netlify.app', '/qr Mein WLAN-Passwort'],
  hash_tools:  ['/hash mein-geheimer-text', '/uuid'],
  password_gen:['/passwort', '/passwort 32'],
}

export default function Lesson() {
  const { skillId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [skill, setSkill] = useState(null)
  const [allSkills, setAllSkills] = useState([])
  const [unlockedSet, setUnlockedSet] = useState(new Set())
  const [keys, setKeys] = useState({})
  const [card, setCard] = useState(1)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewMode, setReviewMode] = useState(false) // freigeschalteten Skill nachlesen

  // Skill laden
  useEffect(() => {
    if (!skillId) return
    setLoading(true)
    // Reset: bei Navigation /lesson/A → /lesson/B bleibt der Component-Instanz
    // erhalten (gleiche Route), daher State manuell zurücksetzen.
    setCard(1)
    setSession(null)
    setSkill(null)
    setReviewMode(false)
    Promise.all([
      fetchSkill(skillId).catch(() => null),
      fetchSkills().catch(() => []),
      user ? fetchUserSkills().catch(() => []) : Promise.resolve([]),
      user ? fetchUserKeys().catch(() => ({})) : Promise.resolve({}),
    ]).then(([sk, allSk, userSk, userKeys]) => {
      setSkill(sk)
      setAllSkills(allSk)
      setUnlockedSet(new Set(userSk.map(x => x.skill_id)))
      setKeys(userKeys ?? {})
      setLoading(false)
    })
  }, [skillId, user])

  // Wenn bereits freigeschaltet → direkt zu Karte 3 (außer der User liest grad nach)
  useEffect(() => {
    if (skill && unlockedSet.has(skill.id) && !reviewMode) setCard(3)
  }, [skill, unlockedSet, reviewMode])

  // Auto-Unlock: konfig-Skills deren Setup schon im Profil/Keys steht
  // → kein Klick auf „Als erledigt markieren" nötig
  useEffect(() => {
    if (!user || !skill) return
    if (skill.verification_type !== 'konfig') return
    if (unlockedSet.has(skill.id)) return
    if (!detectKonfigDone(skill.id, keys)) return
    markSkillUnlocked(skill.id).then(() => {
      setUnlockedSet(prev => new Set([...prev, skill.id]))
      setCard(3)
    }).catch(() => {})
  }, [user, skill, keys, unlockedSet])

  // Realtime: Unlock von außen (z.B. Telegram)
  useEffect(() => {
    if (!user || !skill) return
    const unsub = subscribeUserSkills((row) => {
      if (row.skill_id === skill.id) {
        setUnlockedSet(prev => new Set([...prev, row.skill_id]))
        setCard(3)
      }
    })
    return unsub
  }, [user, skill])

  // Polling-Fallback: Realtime ist nicht 100% zuverlässig (Browser-Tab im Hintergrund,
  // Netzwerk-Wechsel, Verbindungsabbruch, Browsers die WebSocket throttlen).
  // Während Karte 2 alle 2.5s gegen die DB checken, plus sofort beim Eintritt
  // und immer wenn der Tab wieder Fokus bekommt.
  useEffect(() => {
    if (!user || !skill || card !== 1) return
    if (unlockedSet.has(skill.id)) return
    let cancelled = false
    const check = async () => {
      if (cancelled) return
      const us = await fetchUserSkills().catch(() => null)
      if (cancelled || !Array.isArray(us)) return
      if (us.some(s => s.skill_id === skill.id)) {
        setUnlockedSet(new Set(us.map(s => s.skill_id)))
        setCard(3)
      }
    }
    check() // sofort einmal
    const id = setInterval(check, 2500)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, skill, card, unlockedSet])

  async function browserComplete() {
    if (!session) return
    await advanceLesson(session.id, 'verified')
    await markSkillUnlocked(skill.id)
    setUnlockedSet(prev => new Set([...prev, skill.id]))
    setCard(3)
  }

  async function configComplete() {
    if (!session) return
    await advanceLesson(session.id, 'verified')
    await markSkillUnlocked(skill.id)
    setUnlockedSet(prev => new Set([...prev, skill.id]))
    setCard(3)
  }

  // Voraussetzungen prüfen
  const blockingReqs = useMemo(() => {
    if (!skill) return []
    const reqs = Array.isArray(skill.requires) ? skill.requires : []
    return reqs.filter(r => !unlockedSet.has(r))
  }, [skill, unlockedSet])

  // Fehlende Keys
  const missingKeys = useMemo(() => {
    if (!skill) return []
    const required = Array.isArray(skill.required_keys) ? skill.required_keys : []
    return required.filter(k => !keys[k])
  }, [skill, keys])

  // Lesson-Session automatisch starten, sobald die kombinierte Karte sichtbar ist.
  // Kein „Verstanden → Üben"-Klick mehr nötig — Konzept und Üben sind eine Karte.
  useEffect(() => {
    if (!user || !skill || card !== 1) return
    if (session) return
    if (unlockedSet.has(skill.id)) return
    if (blockingReqs.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        const s = await startLesson(skill.id)
        if (cancelled) return
        setSession(s)
        if (skill.verification_type === 'action') {
          await advanceLesson(s.id, 'task')
        }
      } catch { /* still ignorieren */ }
    })()
    return () => { cancelled = true }
  }, [user, skill, card, session, unlockedSet, blockingReqs])

  // Empfehlung: nächster Skill im selben Pfad
  const nextSkill = useMemo(() => {
    if (!skill || allSkills.length === 0) return null
    // Alternativ-Skills: hat man einen, ist der andere überflüssig (z.B. zwei Clouds)
    const ALTERNATIVES = [['gdrive_connect', 'gist_connect']]
    const isRedundant = (id) => ALTERNATIVES.some(pair =>
      pair.includes(id) && pair.some(p => p !== id && unlockedSet.has(p))
    )
    const pickable = (s) => !unlockedSet.has(s.id) && !isRedundant(s.id)

    const samePath = allSkills
      .filter(s => s.path === skill.path && s.id !== skill.id && pickable(s))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    if (samePath[0]) return samePath[0]
    // sonst irgendeinen verfügbaren
    const otherAvailable = allSkills
      .filter(s => pickable(s))
      .filter(s => {
        const r = Array.isArray(s.requires) ? s.requires : []
        return r.every(req => unlockedSet.has(req) || req === skill.id)
      })
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    return otherAvailable[0] ?? null
  }, [skill, allSkills, unlockedSet])

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Lektion…</div>
  }
  if (!skill) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="text-gray-400 mb-4">Diese Fähigkeit konnte nicht geladen werden.</div>
        <Link to="/tech-tree" className="text-nebula-400">Zurück zum Tech-Baum</Link>
      </div>
    )
  }

  const path = PATH_META[skill.path] ?? PATH_META.hub
  const verifKind = VERIFICATION_LABEL[skill.verification_type] ?? VERIFICATION_LABEL.action

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
      <button
        onClick={() => navigate('/tech-tree')}
        className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück zum Tech-Baum
      </button>

      {/* Skill-Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="text-5xl shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: `${path.color}1f`, border: `1px solid ${path.color}55` }}
        >
          {skill.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white m-0">{skill.name}</h1>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${path.color}1f`, color: path.color, border: `1px solid ${path.color}55` }}
            >
              {path.label}
            </span>
            <span className="text-[11px] text-gray-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              {SKILL_TYPE_LABEL[skill.skill_type] ?? skill.skill_type}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${verifKind.classes}`}>
              <verifKind.icon className="w-3 h-3" /> {verifKind.label}
            </span>
            {unlockedSet.has(skill.id) && (
              <span className="text-[11px] text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Freigeschaltet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <StepIndicator current={card} />

      {/* Karte 1+2 kombiniert: Konzept lesen + direkt üben, ohne Zwischenklick */}
      {card === 1 && (
        <div className="space-y-4">
          {reviewMode && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-sm text-emerald-200">📖 Nachlese-Modus — dieser Skill ist schon freigeschaltet.</span>
              <button
                onClick={() => { setReviewMode(false); setCard(3) }}
                className="text-xs text-emerald-300 hover:text-white underline decoration-dotted shrink-0"
              >
                Zurück
              </button>
            </div>
          )}
          <ConceptCard
            skill={skill}
            blockingReqs={blockingReqs}
            missingKeys={missingKeys}
            allSkills={allSkills}
            notLoggedIn={!user}
          />
          {/* Übungsteil nur wenn noch nicht freigeschaltet */}
          {user && blockingReqs.length === 0 && !reviewMode && !unlockedSet.has(skill.id) && (
            <TaskCard
              skill={skill}
              keys={keys}
              onBrowserComplete={browserComplete}
              onConfigComplete={configComplete}
            />
          )}
        </div>
      )}
      {card === 3 && (
        <SuccessCard
          skill={skill}
          nextSkill={nextSkill}
          onBack={() => navigate('/tech-tree')}
          onNext={(id) => navigate(`/lesson/${id}`)}
          onReview={() => { setReviewMode(true); setCard(1) }}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Step-Indicator
   ──────────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Lernen & Üben' },
    { n: 3, label: 'Freigeschaltet' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-nebula-500 text-white' : 'bg-white/5 text-gray-500 border border-white/10'
            }`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-xs ${done ? 'text-emerald-300' : active ? 'text-white font-medium' : 'text-gray-500'}`}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${done ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Karte 1 — Konzept
   ──────────────────────────────────────────────────────────── */

// Öffentliche APIs die wir für den User eingerichtet haben — kein eigener Key nötig.
// Wenn ein Skill hier drin ist, zeigen wir auf Karte 1 einen grünen „Von uns erledigt"-Block.
// `docs` = Link für tiefer-graben (z.B. API-Reference); `about` = Hintergrund-Artikel
// (Wikipedia o.ä.) damit Anfänger das Konzept verstehen können.
const PUBLIC_API_INFO = {
  weather:    {
    name: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    docs: 'https://open-meteo.com/en/docs',
    about: 'https://de.wikipedia.org/wiki/Wettervorhersage',
  },
  wikipedia:  {
    name: 'Wikipedia REST-API',
    url: 'https://www.mediawiki.org/wiki/Wikimedia_REST_API',
    docs: 'https://en.wikipedia.org/api/rest_v1/',
    about: 'https://de.wikipedia.org/wiki/Representational_State_Transfer',
  },
  currency:   {
    name: 'Frankfurter Currency API',
    url: 'https://www.frankfurter.app/',
    docs: 'https://www.frankfurter.app/docs/',
    about: 'https://de.wikipedia.org/wiki/Devisenkurs',
  },
  countries:  {
    name: 'REST Countries',
    url: 'https://restcountries.com/',
    docs: 'https://gitlab.com/restcountries/restcountries',
    about: 'https://de.wikipedia.org/wiki/ISO-3166-1',
  },
  joke_quote: {
    name: 'JokeAPI & ZenQuotes',
    url: 'https://jokeapi.dev/',
    docs: 'https://sv443.net/jokeapi/v2/',
    about: 'https://de.wikipedia.org/wiki/Witz',
  },
  web_search: {
    name: 'DuckDuckGo Instant Answer',
    url: 'https://duckduckgo.com/api',
    docs: 'https://duckduckgo.com/duckduckgo-help-pages/results/sources/',
    about: 'https://de.wikipedia.org/wiki/Suchmaschine',
  },
  rss:        {
    name: 'RSS-Standard',
    url: 'https://www.rssboard.org/rss-specification',
    docs: 'https://www.rssboard.org/rss-specification',
    about: 'https://de.wikipedia.org/wiki/RSS',
  },
}

// Verbrauchs-Anzeige je Skill — nicht jeder Skill misst in „LLM-Tokens".
// Bild- und Audio-Skills verbrauchen kein LLM-Token, aber Anfrage-Kontingent.
const COST_INFO = {
  image_gen: {
    label: 'Verbrauch je Bild',
    value: '1 Bild-Anfrage',
    note: 'Kein LLM-Token — aber jede Anfrage zählt gegen dein HuggingFace-Gratis-Kontingent (Limit pro Stunde/Tag).',
    free: true,
  },
  voice_out: {
    label: 'Verbrauch je Sprachausgabe',
    value: 'Zeichen des Textes',
    note: 'ElevenLabs rechnet in Zeichen ab — 10.000 Zeichen/Monat gratis.',
    free: true,
  },
  whisper: {
    label: 'Verbrauch je Sprachnachricht',
    value: 'Audio-Sekunden',
    note: 'Spracherkennung zählt nach Audio-Länge gegen dein Whisper-Kontingent.',
    free: true,
  },
}

// Bekannte Key-Felder → passende Lektion oder /keys-Seite + Anbieter.
// signup = Direkt-Link wo man den Key gratis holt; signupName = Anbieter-Name.
const KEY_LESSON_MAP = {
  llm_api_key:           { lesson: 'api_keys', label: 'LLM-Key (Groq, OpenAI, …)' },
  telegram_bot_token:    { lesson: 'telegram', label: 'Telegram-Bot-Token' },
  huggingface_key:       { lesson: 'embed_setup', label: 'HuggingFace-Key (Embeddings)',
                           signup: 'https://huggingface.co/settings/tokens', signupName: 'HuggingFace' },
  whisper_key:           { lesson: null, label: 'Whisper-Key (Sprache → Text)',
                           signup: 'https://console.groq.com/keys', signupName: 'Groq (gratis Whisper)' },
  elevenlabs_key:        { lesson: null, label: 'ElevenLabs-Key (Sprachausgabe)',
                           signup: 'https://elevenlabs.io/app/settings/api-keys', signupName: 'ElevenLabs' },
  resend_api_key:        { lesson: null, label: 'Resend-Key (E-Mail-Versand)',
                           signup: 'https://resend.com/api-keys', signupName: 'Resend — 3000 Mails/Monat gratis' },
  replicate_key:         { lesson: null, label: 'Replicate-Key (Bilder)',
                           signup: 'https://replicate.com/account/api-tokens', signupName: 'Replicate' },
  weather_key:           { lesson: null, label: 'Wetter-API-Key' },
}

// Visuelle Stimmungs-Skala — zeigt was die Zahlen 1-5 bedeuten
function MoodScaleVisual() {
  const scale = [
    { n: 1, face: '😢', label: 'sehr schlecht', color: '#ef4444' },
    { n: 2, face: '😟', label: 'schlecht',      color: '#f97316' },
    { n: 3, face: '😐', label: 'geht so',       color: '#eab308' },
    { n: 4, face: '🙂', label: 'gut',           color: '#84cc16' },
    { n: 5, face: '😄', label: 'super',         color: '#22c55e' },
  ]
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-5">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Die Stimmungs-Skala</div>
      <div className="grid grid-cols-5 gap-2">
        {scale.map(s => (
          <div key={s.n} className="text-center">
            <div className="text-3xl mb-1">{s.face}</div>
            <div className="text-lg font-display font-bold" style={{ color: s.color }}>{s.n}</div>
            <div className="text-[10px] text-gray-400 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
      <div className="text-xs text-gray-400 mt-3">
        Also: <strong className="text-white">1 = mieser Tag</strong>, <strong className="text-white">5 = bester Tag</strong>.
        Schick z.B. <code className="bg-black/40 px-1 rounded text-amber-200">stimmung: 4</code> wenn's dir gut geht.
      </div>
    </div>
  )
}

function ConceptCard({ skill, blockingReqs, missingKeys, allSkills, notLoggedIn }) {
  const examples = EXAMPLES[skill.id] || []
  const vt = skill.verification_type
  const publicApi = PUBLIC_API_INFO[skill.id]
  const usesPublicApi = vt === 'action' && missingKeys.length === 0 && publicApi
  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      {/* Warum lohnt sich das für dich? — der konkrete Alltagsnutzen, ganz oben */}
      {skill.practical_benefit && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">💡</span>
            <div>
              <div className="text-amber-200 font-display font-bold text-sm mb-1">Warum lohnt sich das für dich?</div>
              <p className="text-sm text-gray-200 leading-relaxed">{skill.practical_benefit}</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="font-display text-xl font-bold text-white mb-1">Was kannst du damit machen?</h2>
      <p className="text-gray-200 leading-relaxed mb-5">{skill.description}</p>

      {/* Skill-spezifische Visualisierung */}
      {skill.id === 'mood' && <MoodScaleVisual />}

      <h2 className="font-display text-xl font-bold text-white mb-1">Wie es funktioniert</h2>
      <div className="text-gray-300 leading-relaxed mb-5">
        <TermText html={skill.how_it_works} />
      </div>

      {/* API-Info: öffentlich (von uns eingerichtet) vs privat (Key nötig) */}
      {usesPublicApi && (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-emerald-200 font-medium text-sm mb-1">Schnittstelle schon eingerichtet</div>
              <p className="text-xs text-gray-300">
                Dieser Skill nutzt die öffentliche{' '}
                <a href={publicApi.url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline decoration-dotted hover:text-white">
                  {publicApi.name}
                </a>
                . Sie ist kostenlos und für alle frei zugänglich — wir haben sie direkt in deinem Bot verdrahtet. Du musst <strong>nichts</strong> selbst einrichten.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                {publicApi.about && (
                  <a
                    href={publicApi.about}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-300 hover:text-white inline-flex items-center gap-1 no-underline"
                  >
                    📖 Hintergrund lesen <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {publicApi.docs && (
                  <a
                    href={publicApi.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-300 hover:text-white inline-flex items-center gap-1 no-underline"
                  >
                    🔧 API-Doku <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <Link
                  to="/wissen"
                  className="text-[11px] text-emerald-300 hover:text-white inline-flex items-center gap-1 no-underline"
                >
                  💡 Was ist eine API? <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-[11px] text-gray-500 mt-3 italic">
                Bei späteren Skills mit privaten Anbietern (Sprachmodelle, Whisper, ElevenLabs …) wirst du deinen eigenen Key brauchen — das zeigen wir dir dann Schritt für Schritt.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Skill nutzt einen privaten Anbieter, aber du hast den Schlüssel schon */}
      {vt === 'action' && missingKeys.length === 0 && (skill.required_keys?.length > 0) && (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-emerald-200 font-medium text-sm mb-1">Schlüssel vorhanden ✓</div>
              <p className="text-xs text-gray-300">
                Dieser Skill braucht einen privaten Anbieter-Key — und den hast du schon hinterlegt. Du kannst direkt loslegen.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Skill braucht wirklich keinen Schlüssel */}
      {vt === 'action' && missingKeys.length === 0 && !publicApi && !(skill.required_keys?.length > 0) && skill.id !== 'reminder' && skill.id !== 'pomodoro' && (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-emerald-200 font-medium text-sm mb-1">Kein eigener Schlüssel nötig</div>
              <p className="text-xs text-gray-300">
                Dieser Skill läuft direkt auf unserem Server bzw. nutzt eine öffentliche Schnittstelle, die wir für dich verdrahtet haben.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vorschau: was passiert auf Karte 2 */}
      {vt === 'action' && examples.length > 0 && (
        <div className="bg-sky-500/5 border border-sky-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <Send className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sky-200 font-medium text-sm mb-1">Was du gleich machst</div>
              <div className="text-xs text-gray-300 mb-2">
                Du wirst deinem Telegram-Bot eine Nachricht schicken. Zum Beispiel:
              </div>
              <code className="text-xs bg-black/40 text-amber-200 px-2 py-1 rounded inline-block font-mono">{examples[0]}</code>
            </div>
          </div>
        </div>
      )}
      {vt === 'browser' && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-amber-200 font-medium text-sm mb-1">Was du gleich machst</div>
              <div className="text-xs text-gray-300">
                Du probierst das Tool direkt hier im Browser aus — keine Installation, kein Telegram nötig. Sobald du es einmal benutzt hast, ist der Skill freigeschaltet.
              </div>
            </div>
          </div>
        </div>
      )}
      {vt === 'konfig' && (
        <div className="bg-purple-500/5 border border-purple-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <KeyIcon className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-purple-200 font-medium text-sm mb-1">Was du gleich machst</div>
              <div className="text-xs text-gray-300">
                Einmaliges Setup. Wir zeigen dir auf der nächsten Karte genau wo du den Schlüssel/Token herbekommst und du kannst ihn direkt hier einsetzen — kein Umweg.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voraussetzungen / Sperren */}
      {blockingReqs.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-red-300 font-medium text-sm mb-2">Voraussetzungen fehlen</div>
              <div className="space-y-1.5">
                {blockingReqs.map(rid => {
                  const r = allSkills.find(s => s.id === rid)
                  return (
                    <Link
                      key={rid}
                      to={`/lesson/${rid}`}
                      className="text-xs text-red-200 hover:text-white flex items-center gap-2 no-underline"
                    >
                      <span>{r?.icon ?? '🔒'}</span>
                      <span className="underline decoration-dotted">{r?.name ?? rid}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fehlende Keys */}
      {missingKeys.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <KeyIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-amber-300 font-medium text-sm mb-1">Privater Schlüssel nötig</div>
              <p className="text-xs text-gray-300 mb-2">
                Dieser Skill nutzt eine kostenpflichtige bzw. kontogebundene Schnittstelle. Wir können den Anbieter nicht für alle stellen — du brauchst deinen eigenen Key. Klick einen Eintrag an, wir zeigen dir wo du ihn gratis holst und richten alles für dich ein.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                <a
                  href="https://de.wikipedia.org/wiki/Programmierschnittstelle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-300 hover:text-white inline-flex items-center gap-1 no-underline"
                >
                  📖 Was ist ein API-Key? <ExternalLink className="w-3 h-3" />
                </a>
                <Link
                  to="/provider"
                  className="text-[11px] text-amber-300 hover:text-white inline-flex items-center gap-1 no-underline"
                >
                  🔍 Alle 40 Anbieter-Optionen <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-1.5">
                {missingKeys.map(k => {
                  const info = KEY_LESSON_MAP[k] ?? { lesson: null, label: k }
                  if (info.lesson) {
                    return (
                      <Link
                        key={k}
                        to={`/lesson/${info.lesson}`}
                        className="text-xs text-amber-200 hover:text-white flex items-center gap-2 no-underline group"
                      >
                        <span className="underline decoration-dotted">{info.label}</span>
                        <span className="text-[10px] text-amber-400/70 group-hover:text-white">→ Lektion mit Inline-Setup</span>
                        <ArrowRight className="w-3 h-3 ml-auto" />
                      </Link>
                    )
                  }
                  // Kein eigener Lesson-Flow → zeig Direkt-Anmeldelink + /keys-Hinweis
                  return (
                    <div key={k} className="text-xs">
                      <div className="text-amber-200 font-medium mb-1">{info.label}</div>
                      <div className="flex flex-col gap-1 pl-1">
                        {info.signup && (
                          <a
                            href={info.signup}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-300 hover:text-white inline-flex items-center gap-1.5 no-underline"
                          >
                            1. Key gratis holen bei {info.signupName}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <Link
                          to="/keys"
                          className="text-amber-300 hover:text-white inline-flex items-center gap-1.5 no-underline"
                        >
                          {info.signup ? '2. ' : ''}Key auf der Schlüssel-Zentrale einsetzen
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verbrauchs-Hinweis — je nach Skill-Art andere Einheit */}
      {(() => {
        const cost = COST_INFO[skill.id]
        // Default: LLM-Token-Verbrauch
        const label = cost?.label ?? 'Token-Verbrauch je Aufruf'
        const value = cost?.value ?? (skill.token_cost_estimate || '0')
        const note  = cost?.note ?? null
        const free  = cost?.free ?? (!skill.token_cost_estimate || skill.token_cost_estimate === '0')
        return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 mb-5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm text-white font-medium">{value}</div>
              {note && <div className="text-[11px] text-gray-500 mt-0.5">{note}</div>}
            </div>
            {free && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Gratis
              </span>
            )}
          </div>
        )
      })()}

      {notLoggedIn && (
        <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200">
          Du musst angemeldet sein, um Fähigkeiten freizuschalten.{' '}
          <Link to="/login" className="underline">Login</Link>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Karte 2 — Üben (3 Varianten)
   ──────────────────────────────────────────────────────────── */

function TaskCard({ skill, keys, onBrowserComplete, onConfigComplete }) {
  if (skill.verification_type === 'browser') {
    return <BrowserTaskCard skill={skill} onComplete={onBrowserComplete} />
  }
  if (skill.verification_type === 'konfig') {
    return <ConfigTaskCard skill={skill} keys={keys} onComplete={onConfigComplete} />
  }
  return <ActionTaskCard skill={skill} keys={keys} />
}

function ActionTaskCard({ skill, keys }) {
  const examples = EXAMPLES[skill.id] || []
  const botSet = !!keys.telegram_bot_token
  const chatSet = !!keys.telegram_chat_id
  const firstExample = examples[0] || '/' + skill.id

  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-1">Probier's selbst</h2>
      <p className="text-gray-300 text-sm mb-5">
        Drei Schritte — danach schaltet sich diese Karte automatisch um.
      </p>

      {!botSet ? (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-300 font-medium text-sm">Erst Telegram-Bot einrichten</div>
            <p className="text-xs text-gray-300 mt-1 mb-2">
              Du brauchst einen eigenen Telegram-Bot. Dauert 3 Minuten via @BotFather.
            </p>
            <Link to="/lesson/telegram" className="text-xs text-amber-200 hover:text-white inline-flex items-center gap-1 no-underline">
              Zur Bot-Lektion <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Schritt 1: Telegram öffnen */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-7 h-7 rounded-full bg-nebula-500/20 border border-nebula-500/40 text-nebula-200 flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <div className="text-white font-medium text-sm mb-1">Öffne Telegram</div>
              <p className="text-xs text-gray-400 mb-2">
                Geh in den Chat mit deinem Bot {!chatSet && <span className="text-blue-300">— falls du das noch nie gemacht hast, schreib ihm einmal <code className="bg-black/30 px-1 rounded text-blue-200">/start</code>, damit er dich kennt.</span>}
              </p>
            </div>
          </div>

          {/* Schritt 2: Befehl kopieren + senden */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-7 h-7 rounded-full bg-nebula-500/20 border border-nebula-500/40 text-nebula-200 flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <div className="text-white font-medium text-sm mb-2">Schick deinem Bot einen Befehl</div>
              <p className="text-xs text-gray-400 mb-2">
                Tipp auf das Beispiel zum Kopieren, dann in Telegram einfügen und absenden:
              </p>
              <div className="space-y-2">
                {examples.length > 0
                  ? examples.map(ex => <CopyableExample key={ex} text={ex} />)
                  : <CopyableExample text={firstExample} />}
              </div>
            </div>
          </div>

          {/* Schritt 3: Warten */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-nebula-500/20 border border-nebula-500/40 text-nebula-200 flex items-center justify-center text-sm font-bold shrink-0">3</div>
            <div className="flex-1">
              <div className="text-white font-medium text-sm mb-1">Warte auf die Antwort</div>
              <p className="text-xs text-gray-400">
                Sobald der Bot dir antwortet, ist der Skill automatisch freigeschaltet. Diese Seite aktualisiert sich von selbst.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-xl px-4 py-3 mt-5 border border-white/10">
            <Loader2 className="w-4 h-4 animate-spin text-nebula-400 shrink-0" />
            <span>Warte auf Bot-Antwort …</span>
          </div>
        </>
      )}
    </div>
  )
}

function CopyableExample({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="w-full flex items-center gap-2 px-3 py-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-lg text-left transition group cursor-pointer"
    >
      <code className="flex-1 text-sm text-amber-200 font-mono break-all">{text}</code>
      {copied
        ? <span className="text-[10px] text-emerald-300 shrink-0">Kopiert ✓</span>
        : <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
      }
    </button>
  )
}

const BROWSER_DEMO_INTRO = {
  dice:          { what: 'Klick auf „Würfeln" — du bekommst eine zufällige Zahl zwischen 1 und 6.', tip: 'Im Bot würdest du dafür <code>/würfel</code> schicken.' },
  qr_code:       { what: 'Tipp einen Text oder eine URL ein, dann „QR-Code erzeugen" — du siehst sofort den fertigen Code.', tip: 'Im Bot: <code>/qr https://earth-01.netlify.app</code>' },
  math_practice: { what: 'Rechne die Aufgabe im Kopf, tipp die Antwort ein, „Prüfen" — du bekommst sofort Feedback.', tip: 'Dieses Übungs-Tool läuft nur hier im Browser — Aufgaben löst man am besten interaktiv.' },
  hash_tools:    { what: 'Tipp einen Text ein und sieh wie SHA-256 daraus einen einzigartigen Fingerabdruck macht. Ein Buchstabe Unterschied = komplett anderer Hash.', tip: 'Im Bot: <code>/hash mein-text</code> oder <code>/uuid</code> für eine einmalige ID.' },
  password_gen:  { what: 'Klick auf „Generieren" — du bekommst ein kryptografisch sicheres Passwort. Länge selbst einstellbar.', tip: 'Im Bot: <code>/passwort 24</code> für 24 Zeichen.' },
  leak_check:    { what: 'Tipp ein Passwort ein. Wir prüfen anonym (per k-Anonymity, das Passwort verlässt deinen Browser nie), ob es in bekannten Datenlecks auftaucht.', tip: 'Dieses Tool läuft bewusst nur im Browser — ein Passwort gehört nicht in einen Telegram-Chat.' },
}

function BrowserTaskCard({ skill, onComplete }) {
  const [interacted, setInteracted] = useState(false)
  const demo = renderBrowserDemo(skill.id, () => setInteracted(true))
  const intro = BROWSER_DEMO_INTRO[skill.id]
  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-1">Probier's selbst</h2>
      <p className="text-gray-300 text-sm leading-relaxed mb-4">
        {intro?.what ?? 'Spiel mit der Demo unten. Sobald du sie einmal benutzt hast, schalten wir den Skill frei.'}
      </p>

      <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
        {demo}
      </div>

      {intro?.tip && (
        <div className="text-xs text-blue-200 bg-blue-500/5 border border-blue-500/30 rounded-lg px-3 py-2 mb-5"
             dangerouslySetInnerHTML={{ __html: `💡 ${intro.tip}` }} />
      )}

      <button
        onClick={onComplete}
        disabled={!interacted}
        className="w-full bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-display font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {interacted ? <>Freischalten <CheckCircle2 className="w-4 h-4" /></> : 'Erst die Demo oben einmal benutzen'}
      </button>
    </div>
  )
}

function ConfigTaskCard({ skill, keys, onComplete }) {
  // Setup-Skills mit Inline-Eingabe direkt in der Lektion
  if (skill.id === 'api_keys') {
    return <ApiKeyInlineSetup keys={keys} onDone={onComplete} />
  }
  if (skill.id === 'telegram') {
    return <TelegramInlineSetup keys={keys} onDone={onComplete} />
  }

  // Fallback: Schritt-Anleitung mit Link zur passenden Seite
  const setupHints = {
    api_keys: {
      done: !!keys.llm_api_key,
      title: 'Sprachmodell-Key hinterlegen',
      steps: [
        'Hol dir einen gratis Key bei einem Anbieter (z.B. Groq)',
        'Geh auf /keys und füg ihn als „Sprachmodell-Key" ein',
        'Provider wird automatisch erkannt am Prefix',
      ],
      target: '/keys',
      cta: 'Zur Keys-Seite',
    },
    telegram: {
      done: !!keys.telegram_bot_token,
      title: 'Telegram-Bot anlegen',
      steps: [
        'Öffne @BotFather in Telegram, send /newbot',
        'Wähle Anzeigename + Username (endet auf _bot)',
        'Bot-Token kopieren und auf /keys einfügen',
        'Webhook wird automatisch gesetzt',
      ],
      target: '/keys',
      cta: 'Bot einrichten',
    },
    rss: {
      done: false,
      title: 'RSS-Feed abonnieren',
      steps: [
        'Such dir eine Seite mit RSS-Feed — z.B. tagesschau.de, heise.de oder einen Lieblings-Blog',
        'Öffne Telegram, schreib deinem Bot: /rss https://www.tagesschau.de/xml/rss2',
        'Wir prüfen alle 30 Minuten auf neue Einträge und pushen sie zu dir',
        'Mit /feeds siehst du was abonniert ist, mit /unfeed <nr> entfernst du einen',
      ],
      target: 'https://www.tagesschau.de/infoservices/rssfeeds',
      cta: 'Deutsche Beispiel-Feeds (Tagesschau)',
      external: true,
    },
    gdrive_connect: {
      done: keys.cloud_provider === 'gdrive',
      title: 'Google Drive verknüpfen',
      steps: [
        'Geh auf die Daten-Seite (Link unten)',
        'Klick auf „Google Drive verbinden"',
        'Google fragt dich nach Berechtigung — wähl deinen Account und akzeptier den Drive-File-Scope',
        'Du landest zurück hier, „Cloud verbunden" steht in deinem Profil',
        'Dein Bot legt ab jetzt einen Ordner „Earth-Bot" in deinem Drive an und speichert dort Notizen, Audio, Dateien',
      ],
      target: '/data',
      cta: 'Zur Daten-Seite',
    },
    gist_connect: {
      done: keys.cloud_provider === 'gist',
      title: 'GitHub Gist verknüpfen',
      steps: [
        'Auf github.com einloggen, dann github.com/settings/tokens öffnen',
        '„Generate new token (classic)" → Namen vergeben, NUR den Scope „gist" auswählen → Token erstellen',
        'Token kopieren (wird nur einmal angezeigt!), zurück hier auf die Daten-Seite',
        '„GitHub Gist" wählen, Token einfügen, „Gist anlegen" klicken',
        'Wir legen einen privaten Gist als Notiz-Container in deinem Account an',
      ],
      target: 'https://github.com/settings/tokens',
      cta: 'GitHub-Token erstellen',
      external: true,
    },
    embed_setup: {
      done: !!keys.huggingface_key && !!keys.cloud_provider,
      title: 'Embeddings aktivieren (für Semantik-Suche & RAG)',
      steps: [
        'huggingface.co/join — kostenloser Account in 30 Sekunden, keine Kreditkarte',
        'Nach Login: huggingface.co/settings/tokens → „New token" → Typ „Read" → erstellen → kopieren',
        'Token in der API-Keys-Lektion als „HuggingFace-Key" einsetzen',
        'Cloud (Drive oder Gist) verbinden — siehe Karte „Google Drive verknüpfen" oder „GitHub Gist verknüpfen"',
        'Ab jetzt werden alle Notizen automatisch embedded und sind semantisch durchsuchbar',
      ],
      target: 'https://huggingface.co/settings/tokens',
      cta: 'HuggingFace-Token erstellen',
      external: true,
    },
    file_upload: {
      done: false,
      title: 'Datei hochladen (kommt in Phase 2.5)',
      steps: [
        'Voraussetzung: Cloud verbunden (Drive oder Gist) + Embeddings aktiv',
        'Wenn beides steht, kannst du auf /data PDFs, MD-Dateien und Text-Snippets hochladen',
        'Diese werden in deinen Cloud-Speicher gelegt und für die Semantik-Suche indexiert',
        'Status: In Entwicklung — wir bauen das Upload-Widget gerade.',
      ],
      target: '/data',
      cta: 'Zur Daten-Seite',
    },
    mammoth_website: {
      done: true,
      title: 'Mammutaufgabe: eigene Website',
      steps: [
        'Sammle Job-Credits — dein Bot verdient sie durch Schwarm-Arbeit („/arbeiten" an deinen Bot)',
        'Geh auf dein Bot-Profil und klick „Neues Projekt beauftragen"',
        'Beschreib in eigenen Worten was gebaut werden soll — du bekommst ein Angebot mit Job-Plan und Preis',
        'Der Schwarm baut die Website Job für Job. Geht das Guthaben aus, pausiert das Projekt und läuft weiter sobald wieder Credits da sind',
        'Am Ende kriegst du HTML + CSS + Bilder als fertiges ZIP',
      ],
      target: '/bot',
      cta: 'Zum Bot-Profil',
    },
  }
  const hint = setupHints[skill.id]

  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-2">Setup</h2>
      <p className="text-gray-300 leading-relaxed mb-4">{BOT_TEXT.lesson_card2_konfig}</p>

      {hint && (
        <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 mb-5">
          <div className="font-medium text-blue-200 mb-3">{hint.title}</div>
          <ol className="space-y-2 mb-4">
            {hint.steps.map((step, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {hint.target && (
            hint.external ? (
              <a
                href={hint.target}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 text-sm rounded-lg border border-blue-500/30 no-underline"
              >
                {hint.cta} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <Link
                to={hint.target}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 text-sm rounded-lg border border-blue-500/30 no-underline"
              >
                {hint.cta} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )
          )}
        </div>
      )}

      <button
        onClick={onComplete}
        disabled={hint && !hint.done}
        className="w-full bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-display font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {hint && !hint.done ? 'Erst Setup abschließen' : <>Als erledigt markieren <CheckCircle2 className="w-4 h-4" /></>}
      </button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Inline-Setup für Karte 2 — direkt in der Lektion einrichten
   statt Umweg über /keys
   ──────────────────────────────────────────────────────────── */

const LLM_PROVIDERS = [
  { name: 'Groq',       prefix: 'gsk_',     url: 'https://console.groq.com/keys',     note: '~14.000 Tokens/Min gratis · kein Kreditkarte', recommended: true },
  { name: 'OpenRouter', prefix: 'sk-or-',   url: 'https://openrouter.ai/keys',        note: '20 Modelle gratis (Llama, Gemma, DeepSeek)' },
  { name: 'NVIDIA NIM', prefix: 'nvapi-',   url: 'https://build.nvidia.com',          note: '1000 Requests/Tag gratis · top-Modelle' },
  { name: 'OpenAI',     prefix: 'sk-',      url: 'https://platform.openai.com/api-keys', note: 'Beste Qualität · aber kostet ab Tag 1' },
]

function ApiKeyInlineSetup({ keys, onDone }) {
  const [val, setVal] = useState('')
  const [status, setStatus] = useState(null) // {ok, msg}
  const [busy, setBusy] = useState(false)
  const stored = keys.llm_api_key

  async function handleSave() {
    const v = val.trim()
    if (!v) return
    setBusy(true)
    setStatus(null)
    try {
      await saveUserKey('llm_api_key', v)
      const r = await testKey('llm_api_key', v).catch(() => ({ ok: true, message: 'Gespeichert' }))
      setStatus({ ok: !!r.ok, msg: r.message || (r.ok ? 'Funktioniert!' : 'Konnte nicht getestet werden, aber gespeichert.') })
      if (r.ok || r.message?.toLowerCase().includes('cors')) {
        setTimeout(() => onDone(), 600)
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-1">Such dir einen Anbieter und hol dir einen Key</h2>
      <p className="text-gray-300 text-sm mb-5">
        Vier kostenlose Anbieter. Wir empfehlen <strong className="text-emerald-300">Groq</strong> — schnell, großzügiges Free-Tier, keine Kreditkarte. Klick auf den Anbieter, registrier dich, erstell einen Key, kopier ihn rein.
      </p>

      <div className="grid sm:grid-cols-2 gap-2 mb-5">
        {LLM_PROVIDERS.map(p => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative block rounded-xl border p-3 transition no-underline ${
              p.recommended
                ? 'border-emerald-400/40 bg-emerald-500/5 hover:bg-emerald-500/10'
                : 'border-white/10 bg-black/30 hover:border-white/30 hover:bg-black/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-white text-sm">{p.name}</span>
              {p.recommended && <span className="text-[10px] uppercase tracking-wider text-emerald-300">Empfohlen</span>}
              <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-white ml-auto" />
            </div>
            <div className="text-[11px] text-gray-400 mb-1">Key startet mit <code className="bg-black/40 px-1 rounded text-amber-200">{p.prefix}…</code></div>
            <div className="text-[11px] text-gray-300">{p.note}</div>
          </a>
        ))}
      </div>

      <div className="mb-2">
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Schlüssel hier einsetzen</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={stored ? '••• schon gespeichert · neuen Key zum Überschreiben einfügen' : 'gsk_… oder sk-or-… oder nvapi-… oder sk-…'}
            className="flex-1 bg-black/40 border border-white/15 focus:border-nebula-400 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={busy || !val.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Speichern
          </button>
        </div>
        {status && (
          <div className={`mt-2 text-xs ${status.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
            {status.ok ? '✓ ' : '⚠ '}{status.msg}
          </div>
        )}
      </div>

      {stored && (
        <button
          onClick={onDone}
          className="w-full mt-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
        >
          Schon erledigt — weiter <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function TelegramInlineSetup({ keys, onDone }) {
  const [val, setVal] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const stored = keys.telegram_bot_token

  async function handleSave() {
    const v = val.trim()
    if (!v) return
    setBusy(true)
    setStatus(null)
    try {
      await saveUserKey('telegram_bot_token', v)
      const reg = await callTelegramAction('register')
      setStatus({ ok: true, msg: `Bot @${reg.bot.username} verbunden, Webhook läuft.` })
      setTimeout(() => onDone(), 800)
    } catch (e) {
      setStatus({ ok: false, msg: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-1">Erstell deinen Bot beim BotFather</h2>
      <p className="text-gray-300 text-sm mb-5">
        Drei Minuten. Telegram fragt dich nur nach Anzeigename und Username. Danach kriegst du einen Token zurück, den du hier einsetzt.
      </p>

      <ol className="space-y-3 mb-5">
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
          <div className="flex-1">
            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 text-sm font-medium inline-flex items-center gap-1.5">
              @BotFather öffnen <ExternalLink className="w-3 h-3" />
            </a>
            <div className="text-xs text-gray-400 mt-0.5">Schick ihm <code className="bg-black/30 px-1 rounded text-amber-200">/newbot</code></div>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
          <div className="text-sm text-gray-300 flex-1">
            Wähl einen Anzeigenamen (z.B. „Mein Earth-Bot") und einen Username der auf <code className="bg-black/30 px-1 rounded text-amber-200">_bot</code> endet.
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
          <div className="text-sm text-gray-300 flex-1">
            BotFather schickt dir den Token (Format <code className="bg-black/30 px-1 rounded text-amber-200">123:ABC…</code>). Kopier ihn und füg ihn unten ein — wir setzen den Webhook automatisch.
          </div>
        </li>
      </ol>

      <div>
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block">Bot-Token hier einsetzen</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={stored ? '••• schon gespeichert · neuen Token zum Überschreiben einfügen' : '123456789:AAAA…'}
            className="flex-1 bg-black/40 border border-white/15 focus:border-nebula-400 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 outline-none font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={busy || !val.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Verbinden
          </button>
        </div>
        {status && (
          <div className={`mt-2 text-xs ${status.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
            {status.ok ? '✓ ' : '⚠ '}{status.msg}
          </div>
        )}
      </div>

      {stored && (
        <button
          onClick={onDone}
          className="w-full mt-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
        >
          Schon erledigt — weiter <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Karte 3 — Erfolg
   ──────────────────────────────────────────────────────────── */

function SuccessCard({ skill, nextSkill, onBack, onNext, onReview }) {
  const examples = EXAMPLES[skill.id] || []
  const vt = skill.verification_type
  let subline = ''
  if (vt === 'action')      subline = `„${skill.name}" ist freigeschaltet. Dein Bot versteht den Befehl ab jetzt — für immer.`
  else if (vt === 'browser') subline = `„${skill.name}" ist freigeschaltet. Du kannst das Tool jederzeit hier im Browser nutzen.`
  else if (skill.id === 'api_keys')  subline = 'LLM-Key gespeichert. Alle KI-gestützten Skills können ihn jetzt nutzen.'
  else if (skill.id === 'telegram') subline = 'Bot verbunden. Sobald du ihm /start schickst, antwortet er auf deine Befehle.'
  else                       subline = `„${skill.name}" ist erledigt — kommende Skills können das jetzt voraussetzen.`

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-500/15 to-green-500/10 border border-emerald-400/40 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 relative" />
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2 relative">
          {BOT_TEXT.lesson_card3_success}
        </h2>
        <p className="text-gray-200 mb-5 relative leading-relaxed">{subline}</p>

        {examples.length > 0 && (
          <div className="relative mb-5">
            <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">So nutzt du es im Bot</div>
            <div className="space-y-2">
              {examples.slice(0, 2).map(ex => <CopyableExample key={ex} text={ex} />)}
            </div>
          </div>
        )}

        {skill.id === 'telegram' && (
          <div className="relative mb-2">
            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:text-white inline-flex items-center gap-1.5 underline decoration-dotted">
              Bot-Profilbild, Beschreibung & Befehlsmenü bei @BotFather anpassen <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Nächster Schritt */}
      {nextSkill ? (
        <button
          onClick={() => onNext(nextSkill.id)}
          className="w-full bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 text-white font-display font-semibold py-4 rounded-xl transition group cursor-pointer border-none text-left flex items-center gap-3"
        >
          <div className="text-3xl shrink-0">{nextSkill.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider opacity-70">Vorschlag · nächster Skill</div>
            <div className="font-bold">{nextSkill.name}</div>
          </div>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
        </button>
      ) : (
        <div className="text-center text-sm text-gray-400 py-4">
          🎉 Du hast alle verfügbaren Fähigkeiten dieses Pfads freigeschaltet!
        </div>
      )}

      {onReview && (
        <button
          onClick={onReview}
          className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 text-sm rounded-xl border border-white/10 transition flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" /> Lektion nochmal nachlesen
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBack}
          className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl border border-white/10 transition flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Tech-Baum
        </button>
        <Link
          to="/wissen"
          className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl border border-white/10 transition flex items-center justify-center gap-2 no-underline"
        >
          <BookOpen className="w-4 h-4" /> Wissen
        </Link>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Browser-Demos
   ──────────────────────────────────────────────────────────── */

function renderBrowserDemo(skillId, onInteract) {
  switch (skillId) {
    case 'dice':          return <DiceDemo onInteract={onInteract} />
    case 'qr_code':       return <QrDemo onInteract={onInteract} />
    case 'math_practice': return <MathDemo onInteract={onInteract} />
    case 'hash_tools':    return <HashDemo onInteract={onInteract} />
    case 'password_gen':  return <PasswordDemo onInteract={onInteract} />
    case 'leak_check':    return <LeakDemo onInteract={onInteract} />
    case 'prompt_template': return <PromptTemplateDemo onInteract={onInteract} />
    case 'file_upload':   return <FileUploadDemo onInteract={onInteract} />
    default:              return <div className="text-gray-400 text-sm">Demo noch nicht implementiert.</div>
  }
}

// Prompt-Editor: zeigt wie ein System-Prompt die Antwort des Bots formt
function PromptTemplateDemo({ onInteract }) {
  const PRESETS = [
    { label: 'Knapp & sachlich', prompt: 'Antworte in maximal 2 Sätzen, sachlich, ohne Schnörkel.' },
    { label: 'Erklär es wie einem Kind', prompt: 'Erkläre alles so einfach, dass ein 8-Jähriger es versteht. Nutze Vergleiche aus dem Alltag.' },
    { label: 'Locker & mit Humor', prompt: 'Antworte locker, mit einer Prise Humor, wie ein guter Kumpel.' },
  ]
  const [tpl, setTpl] = useState(PRESETS[1].prompt)
  const sample = 'Was ist eine Wolke?'
  function pick(p) { setTpl(p); onInteract?.() }
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">
        Der „System-Prompt" ist die Grundanweisung an deinen Bot — er bestimmt den Ton <em>aller</em> Antworten. Wähl einen Stil oder schreib deinen eigenen:
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => pick(p.prompt)}
            className={`text-xs px-2 py-1 rounded-lg border transition ${
              tpl === p.prompt ? 'bg-nebula-500/30 border-nebula-400 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        value={tpl}
        onChange={(e) => { setTpl(e.target.value); onInteract?.() }}
        rows={3}
        className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 resize-y"
        placeholder="Eigener System-Prompt…"
      />
      <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-xs">
        <div className="text-gray-500 mb-1">Beispiel-Frage: „{sample}"</div>
        <div className="text-gray-300">
          → Mit diesem System-Prompt würde dein Bot im Stil <strong className="text-nebula-300">„{tpl.slice(0, 50)}{tpl.length > 50 ? '…' : ''}"</strong> antworten.
        </div>
      </div>
      <div className="text-[11px] text-gray-500 mt-2">
        💡 Den echten System-Prompt setzt du auf der <Link to="/data" className="text-nebula-300 underline">Daten-Seite</Link> unter „Persona".
      </div>
    </div>
  )
}

// Datei zum Erinnern: liest eine Datei lokal ein und zeigt Eckdaten
function FileUploadDemo({ onInteract }) {
  const [info, setInfo] = useState(null)
  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      setInfo({ name: f.name, size: (f.size / 1024).toFixed(1), words, chars: text.length })
      onInteract?.()
    }
    reader.readAsText(f)
  }
  return (
    <div>
      <div className="text-xs text-gray-400 mb-3">
        Probier's aus: wähl eine Text- oder Markdown-Datei von deinem Gerät. Wir lesen sie hier im Browser ein und zeigen, was drin steckt — genau diese Daten würde dein Bot später durchsuchbar machen.
      </div>
      <label className="block w-full cursor-pointer">
        <span className="inline-block w-full text-center px-3 py-2.5 bg-nebula-500/20 hover:bg-nebula-500/30 border border-nebula-500/30 rounded-lg text-sm text-nebula-100 transition">
          📄 Datei auswählen (.txt, .md)
        </span>
        <input type="file" accept=".txt,.md,.markdown,text/plain" onChange={handleFile} className="hidden" />
      </label>
      {info && (
        <div className="bg-black/30 border border-emerald-500/30 rounded-lg p-3 mt-3 text-xs space-y-1">
          <div className="text-emerald-300 font-medium">✓ {info.name} eingelesen</div>
          <div className="text-gray-300">{info.size} KB · {info.chars} Zeichen · {info.words} Wörter</div>
          <div className="text-gray-500 mt-1">So eine Datei würde dein Bot in Häppchen zerlegen und in deine Cloud legen — danach kann er Fragen dazu beantworten.</div>
        </div>
      )}
      <div className="text-[11px] text-gray-500 mt-2">
        💡 Echte Uploads (mit Cloud-Speicher + Suche) macht die <Link to="/data" className="text-nebula-300 underline">Daten-Seite</Link>.
      </div>
    </div>
  )
}

function DiceDemo({ onInteract }) {
  const [val, setVal] = useState(null)
  return (
    <div className="text-center py-2">
      <div className="text-7xl my-3">{val ?? '🎲'}</div>
      <button
        onClick={() => { setVal(Math.ceil(Math.random() * 6)); onInteract?.() }}
        className="px-5 py-2 bg-nebula-500 hover:bg-nebula-400 text-white rounded-lg font-medium"
      >
        Würfeln
      </button>
    </div>
  )
}

function QrDemo({ onInteract }) {
  const [text, setText] = useState('https://earth-01.netlify.app')
  const [shown, setShown] = useState(false)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  return (
    <div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3"
        placeholder="Text oder URL"
      />
      <button
        onClick={() => { setShown(true); onInteract?.() }}
        className="w-full bg-nebula-500 hover:bg-nebula-400 text-white py-2 rounded-lg text-sm font-medium mb-3"
      >
        QR-Code erzeugen
      </button>
      {shown && (
        <div className="text-center bg-white p-3 rounded-lg">
          <img src={src} alt="QR" className="mx-auto" width={200} height={200} />
        </div>
      )}
    </div>
  )
}

function MathDemo({ onInteract }) {
  const [problem, setProblem] = useState(() => ({ a: Math.ceil(Math.random()*20), b: Math.ceil(Math.random()*20) }))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  function check() {
    const ok = parseInt(answer) === problem.a + problem.b
    setFeedback(ok ? '✓ Richtig!' : `✗ Falsch — richtig wäre ${problem.a + problem.b}`)
    onInteract?.()
  }
  function nextProblem() {
    setProblem({ a: Math.ceil(Math.random()*20), b: Math.ceil(Math.random()*20) })
    setAnswer(''); setFeedback('')
  }
  return (
    <div>
      <div className="text-2xl text-white mb-3 text-center font-display">{problem.a} + {problem.b} = ?</div>
      <input
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-white text-center mb-2"
        type="number"
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={check} className="bg-nebula-500 hover:bg-nebula-400 text-white py-2 rounded-lg text-sm">Prüfen</button>
        <button onClick={nextProblem} className="bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm">Neue Aufgabe</button>
      </div>
      {feedback && (
        <div className={`text-center text-sm mt-3 ${feedback.startsWith('✓') ? 'text-emerald-300' : 'text-red-300'}`}>
          {feedback}
        </div>
      )}
    </div>
  )
}

function HashDemo({ onInteract }) {
  const [text, setText] = useState('Hallo Welt')
  const [hash, setHash] = useState('')
  async function compute() {
    const enc = new TextEncoder().encode(text)
    const buf = await crypto.subtle.digest('SHA-256', enc)
    setHash(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''))
    onInteract?.()
  }
  return (
    <div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-2"
        placeholder="Beliebigen Text eingeben"
      />
      <button onClick={compute} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white py-2 rounded-lg text-sm font-medium mb-3">
        SHA-256 berechnen
      </button>
      {hash && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">SHA-256</div>
          <div className="bg-black/40 rounded-lg p-2 font-mono text-[10px] text-amber-200 break-all">{hash}</div>
          <div className="text-[10px] text-gray-500 mt-2">
            Tipp: Ändere einen einzigen Buchstaben — der ganze Hash wird komplett anders.
          </div>
        </div>
      )}
    </div>
  )
}

function PasswordDemo({ onInteract }) {
  const [pw, setPw] = useState('')
  const [length, setLength] = useState(16)
  function gen() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const arr = new Uint8Array(length)
    crypto.getRandomValues(arr)
    setPw(Array.from(arr).map(b => chars[b % chars.length]).join(''))
    onInteract?.()
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-gray-400">Länge: {length}</label>
        <input
          type="range"
          min="8"
          max="48"
          value={length}
          onChange={e => setLength(parseInt(e.target.value))}
          className="flex-1"
        />
      </div>
      <div className="bg-black/40 p-3 rounded-lg font-mono text-amber-200 mb-3 break-all min-h-[3rem] flex items-center">
        {pw || <span className="text-gray-600 text-sm font-sans">(noch nichts erzeugt)</span>}
      </div>
      <button onClick={gen} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white py-2 rounded-lg font-medium">
        Sicheres Passwort erzeugen
      </button>
    </div>
  )
}

function LeakDemo({ onInteract }) {
  const [pw, setPw] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  async function check() {
    setLoading(true)
    setResult(null)
    const enc = new TextEncoder().encode(pw)
    const buf = await crypto.subtle.digest('SHA-1', enc)
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase()
    const prefix = hex.slice(0, 5), suffix = hex.slice(5)
    try {
      const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
      const lines = (await r.text()).split('\n')
      const hit = lines.find(l => l.split(':')[0] === suffix)
      if (hit) setResult({ leaked: true, count: hit.split(':')[1].trim() })
      else setResult({ leaked: false })
    } catch {
      setResult({ error: 'Prüfung fehlgeschlagen' })
    } finally {
      setLoading(false)
      onInteract?.()
    }
  }
  return (
    <div>
      <input
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-2"
        placeholder="dein Passwort (bleibt lokal)"
      />
      <button
        onClick={check}
        disabled={!pw || loading}
        className="w-full bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
      >
        {loading ? 'Prüfe…' : 'Prüfen (mit k-Anonymity)'}
      </button>
      {result && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${
          result.leaked ? 'bg-red-500/10 border border-red-500/30 text-red-200' :
          result.error  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200' :
                          'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
        }`}>
          {result.leaked && <>⚠ <strong>Geleakt!</strong> {result.count}× in bekannten Datenlecks gefunden. Wechsle es überall, wo du es nutzt.</>}
          {!result.leaked && !result.error && <>✓ Bisher in keinem bekannten Datenleck aufgetaucht.</>}
          {result.error && result.error}
        </div>
      )}
    </div>
  )
}
