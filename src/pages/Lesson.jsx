import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { fetchSkill, fetchUserSkills, startLesson, advanceLesson, markSkillUnlocked, subscribeUserSkills } from '../lib/skillService'
import { TermText } from '../components/MiniWiki'
import { BOT_TEXT } from '../lib/botMessages'
import { useAuth } from '../contexts/AuthContext'

export default function Lesson() {
  const { skillId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [skill, setSkill] = useState(null)
  const [card, setCard] = useState(1)
  const [session, setSession] = useState(null)
  const [unlockedSet, setUnlockedSet] = useState(new Set())

  useEffect(() => {
    if (!skillId) return
    fetchSkill(skillId).then(setSkill).catch(console.error)
    if (user) {
      fetchUserSkills().then(u => setUnlockedSet(new Set(u.map(x => x.skill_id))))
    }
  }, [skillId, user])

  useEffect(() => {
    if (skill && unlockedSet.has(skill.id)) setCard(3)
  }, [skill, unlockedSet])

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

  if (!skill) {
    return <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Lesson…</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
      <button onClick={() => navigate('/tech-tree')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Zurück zum Tech-Baum
      </button>

      <div className="flex gap-2 mb-6">
        <Dot active={card === 1} done={card > 1} />
        <Dot active={card === 2} done={card > 2} />
        <Dot active={card === 3} done={card > 3} />
      </div>

      {card === 1 && <ConceptCard skill={skill} onNext={startLessonClick} />}
      {card === 2 && <TaskCard skill={skill} onBrowserComplete={browserComplete} />}
      {card === 3 && <SuccessCard skill={skill} onBack={() => navigate('/tech-tree')} />}
    </div>
  )
}

function Dot({ active, done }) {
  return <div className={`flex-1 h-1 rounded-full ${done ? 'bg-green-400' : active ? 'bg-nebula-500' : 'bg-white/10'}`} />
}

function ConceptCard({ skill, onNext }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <div className="text-4xl mb-3">{skill.icon}</div>
      <h2 className="font-display text-2xl font-bold text-white mb-2">{skill.name}</h2>
      <div className="text-xs uppercase tracking-wider text-nebula-400 mb-4">Pfad: {skill.path} · Typ: {skill.skill_type}</div>

      <h3 className="text-xs uppercase text-gray-400 mb-1">Was kannst du damit machen</h3>
      <p className="text-gray-200 mb-5">{skill.description}</p>

      <h3 className="text-xs uppercase text-gray-400 mb-1">Wie es funktioniert</h3>
      <div className="text-gray-300 mb-5 leading-relaxed">
        <TermText html={skill.how_it_works} />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5 text-sm text-amber-200">
        <strong>Token-Verbrauch:</strong> {skill.token_cost_estimate}
      </div>

      <button onClick={onNext} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Verstanden → Üben
      </button>
    </div>
  )
}

function TaskCard({ skill, onBrowserComplete }) {
  if (skill.verification_type === 'browser') {
    return <BrowserTaskCard skill={skill} onComplete={onBrowserComplete} />
  }
  if (skill.verification_type === 'konfig') {
    return <ConfigTaskCard skill={skill} />
  }
  return <ActionTaskCard skill={skill} />
}

function ActionTaskCard({ skill }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Probier's selbst</h2>
      <p className="text-gray-200 mb-4">Schreib deinem Telegram-Bot eine passende Nachricht — sobald er den Befehl erkennt, schaltet diese Karte hier automatisch um.</p>

      <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-500 mb-1">Beispiel-Nachrichten:</div>
        <ExampleHint skillId={skill.id} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-nebula-400" />
        {BOT_TEXT.lesson_card2_waiting}
      </div>
    </div>
  )
}

function ExampleHint({ skillId }) {
  const examples = {
    weather: ['/wetter Berlin', 'wie ist das wetter in Hamburg'],
    web_search: ['/suche Quantencomputer', 'finde Vegane Rezepte'],
    wikipedia: ['/wiki Photosynthese', 'was ist Quantenphysik'],
    currency: ['wie viel sind 50 USD in EUR', '/kurs USD EUR'],
    countries: ['/land Frankreich', 'info zu Japan'],
    notes: ['notiz: Milch kaufen', '/notiz Bürotermin morgen'],
    mood: ['stimmung: 4', '/stimmung 3'],
    habits: ['habit: meditiert', 'heute Sport gemacht'],
    reminder: ['in 30 min erinnere mich an Yoga', 'in 2 stunden erinnere mich an den Kuchen'],
    pomodoro: ['/pomodoro'],
    joke_quote: ['/witz', 'witz'],
  }
  const list = examples[skillId] || ['(noch keine Beispiele)']
  return (
    <ul className="space-y-1 text-sm">
      {list.map(e => <li key={e} className="text-amber-200 font-mono">{e}</li>)}
    </ul>
  )
}

function BrowserTaskCard({ skill, onComplete }) {
  const demo = renderBrowserDemo(skill.id)
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Probier's selbst</h2>
      <p className="text-gray-200 mb-4">{BOT_TEXT.lesson_card2_browser}</p>
      <div className="bg-black/30 border border-white/10 rounded-lg p-4 mb-4">
        {demo}
      </div>
      <button onClick={onComplete} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Hab's verstanden — freischalten
      </button>
    </div>
  )
}

function ConfigTaskCard({ skill }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Setup</h2>
      <p className="text-gray-200 mb-4">{BOT_TEXT.lesson_card2_konfig}</p>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-200">
        Für „{skill.name}" gibt's eine eigene Setup-Seite. Geh auf <strong>/keys</strong> und folge dort der Anleitung.
      </div>
    </div>
  )
}

function SuccessCard({ skill, onBack }) {
  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/40 rounded-2xl p-6">
      <CheckCircle2 className="w-10 h-10 text-green-400 mb-3" />
      <h2 className="font-display text-2xl font-bold text-white mb-2">{BOT_TEXT.lesson_card3_success}</h2>
      <p className="text-gray-300 mb-4">
        „{skill.name}" ist jetzt freigeschaltet. Du kannst die Fähigkeit ab sofort nutzen.
      </p>
      <button onClick={onBack} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Zurück zum Tech-Baum
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
function renderBrowserDemo(skillId) {
  switch (skillId) {
    case 'dice': return <DiceDemo />
    case 'qr_code': return <QrDemo />
    case 'math_practice': return <MathDemo />
    case 'hash_tools': return <HashDemo />
    case 'password_gen': return <PasswordDemo />
    case 'leak_check': return <LeakDemo />
    default: return <div className="text-gray-400 text-sm">Demo noch nicht implementiert.</div>
  }
}

function DiceDemo() {
  const [val, setVal] = useState(null)
  return (
    <div className="text-center">
      <div className="text-6xl my-3">{val ?? '?'}</div>
      <button onClick={() => setVal(Math.ceil(Math.random() * 6))} className="px-4 py-2 bg-nebula-500 text-white rounded">
        Würfeln
      </button>
    </div>
  )
}

function QrDemo() {
  const [text, setText] = useState('https://earth-01.netlify.app')
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-3" placeholder="Text oder URL für den QR-Code" />
      <div className="text-center bg-white p-3 rounded">
        <img src={src} alt="QR" className="mx-auto" width={200} height={200} />
      </div>
    </div>
  )
}

function MathDemo() {
  const [problem] = useState(() => ({ a: Math.ceil(Math.random()*20), b: Math.ceil(Math.random()*20) }))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  return (
    <div>
      <div className="text-xl text-white mb-3 text-center">{problem.a} + {problem.b} = ?</div>
      <input value={answer} onChange={e => setAnswer(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
      <button onClick={() => setFeedback(parseInt(answer) === problem.a + problem.b ? '✓ Richtig!' : '✗ Falsch')} className="w-full bg-nebula-500 text-white py-2 rounded text-sm">
        Prüfen
      </button>
      {feedback && <div className="text-center text-sm mt-2 text-amber-200">{feedback}</div>}
    </div>
  )
}

function HashDemo() {
  const [text, setText] = useState('Hallo Welt')
  const [hash, setHash] = useState('')
  async function compute() {
    const enc = new TextEncoder().encode(text)
    const buf = await crypto.subtle.digest('SHA-256', enc)
    setHash(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''))
  }
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
      <button onClick={compute} className="w-full bg-nebula-500 text-white py-2 rounded text-sm mb-3">SHA-256 berechnen</button>
      {hash && <div className="bg-black/40 rounded p-2 font-mono text-[10px] text-amber-200 break-all">{hash}</div>}
    </div>
  )
}

function PasswordDemo() {
  const [pw, setPw] = useState('')
  function gen() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    setPw(Array.from(arr).map(b => chars[b % chars.length]).join(''))
  }
  return (
    <div className="text-center">
      <div className="bg-black/40 p-3 rounded font-mono text-amber-200 mb-3 break-all">{pw || '(klick erzeugen)'}</div>
      <button onClick={gen} className="px-4 py-2 bg-nebula-500 text-white rounded">Sicheres Passwort erzeugen</button>
    </div>
  )
}

function LeakDemo() {
  const [pw, setPw] = useState('')
  const [result, setResult] = useState('')
  async function check() {
    setResult('Prüfe…')
    const enc = new TextEncoder().encode(pw)
    const buf = await crypto.subtle.digest('SHA-1', enc)
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase()
    const prefix = hex.slice(0, 5), suffix = hex.slice(5)
    try {
      const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
      const lines = (await r.text()).split('\n')
      const hit = lines.find(l => l.split(':')[0] === suffix)
      if (hit) setResult(`⚠ Geleakt — ${hit.split(':')[1].trim()} mal gefunden!`)
      else setResult('✓ Bisher unbekannt — gut!')
    } catch { setResult('Prüfung fehlgeschlagen') }
  }
  return (
    <div>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" placeholder="dein Passwort" />
      <button onClick={check} disabled={!pw} className="w-full bg-nebula-500 disabled:opacity-50 text-white py-2 rounded text-sm">
        Prüfen (k-Anonymity)
      </button>
      {result && <div className="text-center text-sm mt-3 text-amber-200">{result}</div>}
    </div>
  )
}
