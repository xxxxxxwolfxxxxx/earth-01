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
import { fetchUserKeys } from '../lib/keyService'
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
  rss:         ['/rss https://hnrss.org/frontpage'],
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

  // Skill laden
  useEffect(() => {
    if (!skillId) return
    setLoading(true)
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

  // Wenn bereits freigeschaltet → direkt zu Karte 3
  useEffect(() => {
    if (skill && unlockedSet.has(skill.id)) setCard(3)
  }, [skill, unlockedSet])

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

  async function startLessonClick() {
    if (!user) { navigate('/login'); return }
    const s = await startLesson(skill.id)
    setSession(s)
    setCard(2)
    if (skill.verification_type === 'action') {
      await advanceLesson(s.id, 'task')
    }
  }

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

  // Empfehlung: nächster Skill im selben Pfad
  const nextSkill = useMemo(() => {
    if (!skill || allSkills.length === 0) return null
    const samePath = allSkills
      .filter(s => s.path === skill.path && s.id !== skill.id && !unlockedSet.has(s.id))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    if (samePath[0]) return samePath[0]
    // sonst irgendeinen verfügbaren
    const otherAvailable = allSkills
      .filter(s => !unlockedSet.has(s.id))
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

      {/* Karten */}
      {card === 1 && (
        <ConceptCard
          skill={skill}
          blockingReqs={blockingReqs}
          missingKeys={missingKeys}
          allSkills={allSkills}
          onNext={startLessonClick}
          notLoggedIn={!user}
        />
      )}
      {card === 2 && (
        <TaskCard
          skill={skill}
          keys={keys}
          onBrowserComplete={browserComplete}
          onConfigComplete={configComplete}
        />
      )}
      {card === 3 && (
        <SuccessCard
          skill={skill}
          nextSkill={nextSkill}
          onBack={() => navigate('/tech-tree')}
          onNext={(id) => navigate(`/lesson/${id}`)}
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
    { n: 1, label: 'Konzept' },
    { n: 2, label: 'Üben' },
    { n: 3, label: 'Freischalten' },
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

function ConceptCard({ skill, blockingReqs, missingKeys, allSkills, onNext, notLoggedIn }) {
  const canStart = blockingReqs.length === 0
  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-1">Was kannst du damit machen?</h2>
      <p className="text-gray-200 leading-relaxed mb-5">{skill.description}</p>

      <h2 className="font-display text-xl font-bold text-white mb-1">Wie es funktioniert</h2>
      <div className="text-gray-300 leading-relaxed mb-5">
        <TermText html={skill.how_it_works} />
      </div>

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
            <div>
              <div className="text-amber-300 font-medium text-sm mb-1">API-Schlüssel benötigt</div>
              <div className="text-xs text-gray-300 mb-2">
                Für diese Fähigkeit brauchst du: <code className="bg-black/30 px-1 rounded text-amber-200">{missingKeys.join(', ')}</code>
              </div>
              <Link to="/keys" className="text-xs text-amber-200 hover:text-white inline-flex items-center gap-1 no-underline">
                Schlüssel einrichten <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Token-Hinweis */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 mb-5">
        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1">
          <div className="text-xs text-gray-400">Token-Verbrauch je Aufruf</div>
          <div className="text-sm text-white font-medium">{skill.token_cost_estimate || '0'}</div>
        </div>
        {(!skill.token_cost_estimate || skill.token_cost_estimate === '0') && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Gratis
          </span>
        )}
      </div>

      {notLoggedIn && (
        <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 mb-5 text-sm text-blue-200">
          Du musst angemeldet sein, um Fähigkeiten freizuschalten.{' '}
          <Link to="/login" className="underline">Login</Link>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canStart || notLoggedIn}
        className="w-full bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-display font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {notLoggedIn ? 'Erst einloggen' : canStart ? 'Verstanden → Üben' : 'Erst Voraussetzungen freischalten'}
        {canStart && !notLoggedIn && <ArrowRight className="w-4 h-4" />}
      </button>
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

  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-2">Probier's selbst</h2>
      <p className="text-gray-300 leading-relaxed mb-4">
        Schreib deinem Telegram-Bot eine passende Nachricht. Sobald er den Befehl erkennt, schaltet
        sich diese Karte automatisch um.
      </p>

      {!botSet && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-300 font-medium text-sm">Telegram-Bot fehlt</div>
            <p className="text-xs text-gray-300 mt-1 mb-2">
              Du brauchst zuerst einen eigenen Bot. Setup dauert 3 Minuten.
            </p>
            <Link to="/keys" className="text-xs text-amber-200 hover:text-white inline-flex items-center gap-1 no-underline">
              Bot einrichten <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {botSet && !chatSet && (
        <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <Send className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200">
            <strong>Letzter Schritt:</strong> Öffne deinen Bot und schreib ihm einmal <code className="bg-black/30 px-1 rounded">/start</code> — danach kennt er dich.
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Beispiel-Nachrichten</div>
          <div className="space-y-2">
            {examples.map(ex => <CopyableExample key={ex} text={ex} />)}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-xl px-4 py-3 mt-4">
        <Loader2 className="w-4 h-4 animate-spin text-nebula-400 shrink-0" />
        <span>{BOT_TEXT.lesson_card2_waiting}</span>
      </div>
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

function BrowserTaskCard({ skill, onComplete }) {
  const [interacted, setInteracted] = useState(false)
  const demo = renderBrowserDemo(skill.id, () => setInteracted(true))
  return (
    <div className="bg-gradient-to-br from-cosmos-900 to-cosmos-800 border border-white/10 rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-white mb-2">Probier's selbst</h2>
      <p className="text-gray-300 leading-relaxed mb-4">{BOT_TEXT.lesson_card2_browser}</p>

      <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-5">
        {demo}
      </div>

      <button
        onClick={onComplete}
        disabled={!interacted}
        className="w-full bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white font-display font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {interacted ? <>Freischalten <CheckCircle2 className="w-4 h-4" /></> : 'Erst die Demo ausprobieren'}
      </button>
    </div>
  )
}

function ConfigTaskCard({ skill, keys, onComplete }) {
  // Spezifische Setup-Anleitung je Skill
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
        'Find eine Webseite mit RSS-Feed (z.B. tagesschau.de/xml/rss2)',
        'Schick deinem Bot: /rss <URL>',
        'Wir prüfen alle 30 Min auf neue Einträge',
      ],
      target: null,
      cta: null,
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
            <Link
              to={hint.target}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 text-sm rounded-lg border border-blue-500/30 no-underline"
            >
              {hint.cta} <ExternalLink className="w-3.5 h-3.5" />
            </Link>
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
   Karte 3 — Erfolg
   ──────────────────────────────────────────────────────────── */

function SuccessCard({ skill, nextSkill, onBack, onNext }) {
  const examples = EXAMPLES[skill.id] || []
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-500/15 to-green-500/10 border border-emerald-400/40 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 relative" />
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2 relative">
          {BOT_TEXT.lesson_card3_success}
        </h2>
        <p className="text-gray-200 mb-5 relative leading-relaxed">
          „{skill.name}" ist freigeschaltet. Dein Bot versteht ab sofort den Befehl — für immer.
        </p>

        {examples.length > 0 && (
          <div className="relative mb-5">
            <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">So nutzt du es</div>
            <div className="space-y-2">
              {examples.slice(0, 2).map(ex => <CopyableExample key={ex} text={ex} />)}
            </div>
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
    default:              return <div className="text-gray-400 text-sm">Demo noch nicht implementiert.</div>
  }
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
