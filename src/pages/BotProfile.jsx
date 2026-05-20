import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Key, Send, Sprout, Zap, Network, BookOpen, LogIn, CheckCircle2,
  Database, Cloud, Sparkles, Activity, Briefcase, Home as HomeIcon, Coins, Download,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchWorkStatus, setBotAtWork, fetchMyMammothTasks, startMammothWebsite } from '../lib/cloudService'

export default function BotProfile() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [skills, setSkills] = useState([])
  const [usage, setUsage] = useState([])
  const [contributions, setContributions] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    Promise.all([
      supabase.from('profiles').select(`
        bot_name, bot_role, bot_tone, bot_extra,
        telegram_bot_token, telegram_chat_id, telegram_linked_at,
        cloud_provider, home_city,
        llm_api_key, huggingface_key, elevenlabs_key, resend_api_key,
        donate_tokens, donate_threshold, swarm_jobs_today,
        onboarding_dismissed
      `).eq('id', user.id).single(),
      supabase.from('user_skills').select(`
        skill_id, unlocked_at,
        skills(id, name, icon, path)
      `).eq('user_id', user.id).order('unlocked_at', { ascending: false }),
      supabase.from('skill_usage_log').select('skill_id, count, date')
        .eq('user_id', user.id).order('date', { ascending: false }).limit(30),
      supabase.from('article_jobs').select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id).eq('status', 'done'),
    ]).then(([p, s, u, c]) => {
      setProfile(p.data ?? null)
      setSkills(s.data ?? [])
      setUsage(u.data ?? [])
      setContributions(c.count ?? 0)
      setLoading(false)
    })
  }, [user])

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Bot className="w-4 h-4" /> Mein Bot
        </div>
        <h1 className="font-display text-3xl font-bold text-white mb-4">Login benötigt</h1>
        <p className="text-gray-400 mb-6 text-sm">Deine Bot-Übersicht ist privat — meld dich an um sie zu sehen.</p>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl no-underline">
          <LogIn className="w-4 h-4" /> Zum Login
        </Link>
      </div>
    )
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 pt-24 text-center text-gray-400">Lade Bot-Profil…</div>
  }

  // Setup-Stufen ermitteln
  const setupSteps = [
    { id: 'llm',      label: 'Sprachmodell-Key',  done: !!profile?.llm_api_key },
    { id: 'telegram', label: 'Telegram-Bot',      done: !!profile?.telegram_bot_token && !!profile?.telegram_webhook_secret },
    { id: 'chat',     label: 'Erste Nachricht',   done: !!profile?.telegram_chat_id },
    { id: 'skill',    label: 'Erster Skill',      done: skills.length > 0 },
  ]
  const allDone = setupSteps.every(s => s.done)
  const setupProgress = setupSteps.filter(s => s.done).length

  // Skills nach Pfad gruppieren
  const skillsByPath = skills.reduce((acc, s) => {
    const path = s.skills?.path ?? 'other'
    if (!acc[path]) acc[path] = []
    acc[path].push(s)
    return acc
  }, {})

  // Usage-Stats: Gesamt + Top 5
  const totalUses = usage.reduce((sum, u) => sum + (u.count ?? 0), 0)
  const topSkills = useMemo(() => {
    const map = new Map()
    for (const u of usage) {
      map.set(u.skill_id, (map.get(u.skill_id) ?? 0) + u.count)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [usage])

  const botName = profile?.bot_name || 'Dein Bot'

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="text-5xl shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center bg-nebula-500/20 border border-nebula-500/40">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-xs mb-2">
            <Bot className="w-3 h-3" /> Mein Bot
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white m-0">{botName}</h1>
          {profile?.bot_role && (
            <p className="text-gray-300 mt-1">{profile.bot_role}</p>
          )}
          {profile?.bot_tone && (
            <p className="text-gray-500 text-sm italic mt-1">„{profile.bot_tone}"</p>
          )}
          {profile?.home_city && (
            <div className="text-xs text-gray-500 mt-2">📍 {profile.home_city}</div>
          )}
        </div>
      </div>

      {/* Setup-Fortschritt */}
      <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-white text-lg font-bold m-0">Setup</h2>
          <span className="text-sm text-gray-400">{setupProgress} / {setupSteps.length}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {setupSteps.map(s => (
            <div key={s.id} className={`p-3 rounded-lg border ${s.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">{s.label}</span>
                {s.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <div className="w-4 h-4 rounded-full border border-white/20" />
                }
              </div>
            </div>
          ))}
        </div>
        {!allDone && (
          <Link to="/keys" className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-nebula-500/20 hover:bg-nebula-500/30 text-nebula-100 text-xs rounded-lg border border-nebula-500/30 no-underline transition">
            Fortsetzen → /keys
          </Link>
        )}
      </section>

      {/* Stats-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Skills" value={skills.length} icon={Network} color="purple" />
        <StatCard label="Aufrufe gesamt" value={totalUses} icon={Activity} color="blue" />
        <StatCard label="Schwarm-Beiträge" value={contributions} icon={Sprout} color="emerald" />
        <StatCard label="Jobs heute" value={`${profile?.swarm_jobs_today ?? 0} / 3`} icon={Zap} color="amber" />
      </div>

      {/* Aktive Services */}
      <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
        <h2 className="font-display text-white text-lg font-bold mb-3">Verknüpfte Dienste</h2>
        <div className="flex flex-wrap gap-2">
          <ServiceChip ok={!!profile?.llm_api_key}        label="Sprachmodell" icon={Sparkles} />
          <ServiceChip ok={!!profile?.telegram_bot_token} label="Telegram"     icon={Send} />
          <ServiceChip ok={!!profile?.huggingface_key}    label="HuggingFace"  icon={Sparkles} />
          <ServiceChip ok={!!profile?.elevenlabs_key}     label="ElevenLabs"   icon={Sparkles} />
          <ServiceChip ok={!!profile?.resend_api_key}     label="Resend Mail"  icon={Sparkles} />
          <ServiceChip ok={!!profile?.cloud_provider}     label={profile?.cloud_provider === 'gdrive' ? 'Drive' : profile?.cloud_provider === 'gist' ? 'Gist' : 'Cloud'} icon={Cloud} />
          <ServiceChip ok={!!profile?.donate_tokens}      label="Token-Spende" icon={Sprout} />
        </div>
      </section>

      {/* Phase 4: Bot-Arbeit + Mammutaufgaben */}
      <WorkSection />

      {/* Top Skills */}
      {topSkills.length > 0 && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3">Meistgenutzt</h2>
          <div className="space-y-2">
            {topSkills.map(([skillId, count]) => {
              const skill = skills.find(s => s.skill_id === skillId)?.skills
              if (!skill) return null
              return (
                <div key={skillId} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <span className="text-xl">{skill.icon}</span>
                  <Link to={`/lesson/${skill.id}`} className="text-white text-sm flex-1 no-underline hover:text-nebula-300">
                    {skill.name}
                  </Link>
                  <span className="text-xs text-amber-300 font-mono">{count}×</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Freigeschaltete Skills nach Pfad */}
      {skills.length > 0 && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3">Freigeschaltete Fähigkeiten</h2>
          {Object.entries(skillsByPath).map(([path, ss]) => (
            <div key={path} className="mb-4 last:mb-0">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">{pathLabel(path)}</div>
              <div className="flex flex-wrap gap-2">
                {ss.map(s => (
                  <Link key={s.skill_id} to={`/lesson/${s.skill_id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:border-white/30 text-xs text-white no-underline transition">
                    <span>{s.skills?.icon}</span>
                    <span>{s.skills?.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {skills.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Noch keine Skills freigeschaltet. <Link to="/tech-tree" className="text-nebula-400">Such dir einen aus</Link>.
        </div>
      )}

      {/* Footer-Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12">
        <FooterLink to="/tech-tree" icon={Network} label="Tech-Baum" />
        <FooterLink to="/data" icon={Database} label="Daten + Persona" />
        <FooterLink to="/keys" icon={Key} label="Schlüssel" />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    purple:  'border-purple-500/20 bg-purple-500/5 text-purple-300',
    blue:    'border-blue-500/20 bg-blue-500/5 text-blue-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    amber:   'border-amber-500/20 bg-amber-500/5 text-amber-300',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
        <Icon className="w-3.5 h-3.5 opacity-60" />
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  )
}

function ServiceChip({ ok, label, icon: Icon }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
      ok
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
        : 'bg-white/5 border-white/10 text-gray-500'
    }`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      {ok && <CheckCircle2 className="w-3 h-3" />}
    </div>
  )
}

function FooterLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl border border-white/10 transition no-underline">
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  )
}

function pathLabel(path) {
  const m = {
    hub: 'Hub',
    daten: 'Daten aus dem Netz',
    sicherheit: 'Sicherheit',
    tracking: 'Mich verstehen',
    llm: 'Sprachmodelle',
    automation: 'Automation',
    cloud: 'Eigene Cloud',
    spielerei: 'Werkzeuge',
  }
  return m[path] ?? path
}

// ─── Phase 4: WorkSection (Bot-Status + Mammutaufgaben) ─────────────────

function WorkSection() {
  const [status, setStatus] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [briefForm, setBriefForm] = useState({ title: '', tagline: '', tone: 'minimal' })
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    const [s, t] = await Promise.all([fetchWorkStatus(), fetchMyMammothTasks()])
    setStatus(s); setTasks(t); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  if (loading) return null
  if (!status) return null

  async function toggleWork() {
    setBusy(true); setMsg('')
    try {
      await setBotAtWork(!status.bot_at_work)
      await reload()
      setMsg(status.bot_at_work ? '🏠 Bot ist zurück.' : '🤝 Bot ist los — pickt jetzt Jobs.')
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  async function submitBrief() {
    if (!briefForm.title.trim()) return
    setBusy(true); setMsg('')
    try {
      const r = await startMammothWebsite(briefForm)
      setMsg(`🌐 Website-Projekt gestartet! ${r.jobs_created} Jobs in der Pipeline.`)
      setBriefForm({ title: '', tagline: '', tone: 'minimal' })
      setShowForm(false)
      await reload()
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  const credits = Number(status.job_credits ?? 0)
  const canStart = credits >= 50

  const startedAgo = status.bot_work_started_at
    ? Math.floor((Date.now() - new Date(status.bot_work_started_at).getTime()) / 60_000)
    : null

  return (
    <section className="mb-8 p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-white text-lg font-bold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-400" /> Bot-Arbeit & Mammutaufgaben
        </h2>
        <div className="flex items-center gap-2 text-amber-300 font-display font-bold text-xl">
          <Coins className="w-5 h-5" /> {credits.toFixed(1)}
        </div>
      </div>

      {msg && <div className="mb-3 text-xs text-blue-200 bg-blue-500/10 rounded p-2">{msg}</div>}

      {/* Bot-Status-Box */}
      <div className={`p-4 rounded-xl border mb-4 ${status.bot_at_work
        ? 'border-emerald-500/40 bg-emerald-500/10 animate-pulse'
        : 'border-white/10 bg-white/[0.03]'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm text-white font-medium">
              {status.bot_at_work ? '🤝 Dein Bot arbeitet' : '🏠 Dein Bot ist zu Hause'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {status.bot_at_work && startedAgo !== null && `seit ${startedAgo} Min · `}
              Lifetime: {status.jobs_done_total} Jobs erledigt
            </div>
          </div>
          <button onClick={toggleWork} disabled={busy}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition disabled:opacity-50 ${
              status.bot_at_work
                ? 'bg-white/5 hover:bg-red-500/15 text-gray-200 hover:text-red-200 border-white/10'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-emerald-500/30'
            }`}>
            {status.bot_at_work ? <><HomeIcon className="w-3.5 h-3.5 inline mr-1" /> Heim holen</> : '🤝 Arbeiten schicken'}
          </button>
        </div>
      </div>

      {/* Mammoth-Liste */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Meine Projekte</div>
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">🌐 {t.title}</div>
                    <div className="text-[10px] text-gray-500">
                      {t.status} · {new Date(t.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  {t.result_url && (
                    <a href={t.result_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 no-underline">
                      <Download className="w-3 h-3" /> Download
                    </a>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    style={{ width: `${t.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neues Projekt starten */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} disabled={!canStart}
          className="w-full px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed text-cyan-100 rounded-xl border border-cyan-500/30 disabled:border-white/10 transition flex items-center justify-center gap-2 text-sm font-medium">
          🌐 Persönliche Website (50 Credits) {canStart ? 'starten' : `— noch ${(50 - credits).toFixed(1)} Credits sammeln`}
        </button>
      )}

      {showForm && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-3">
          <div className="text-sm text-white font-medium">🌐 Neue Website (kostet 50 Credits)</div>
          <input type="text" value={briefForm.title}
            onChange={e => setBriefForm(s => ({ ...s, title: e.target.value }))}
            placeholder='Titel der Seite (z.B. „Mein Portfolio")'
            className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <input type="text" value={briefForm.tagline}
            onChange={e => setBriefForm(s => ({ ...s, tagline: e.target.value }))}
            placeholder="Slogan / Untertitel"
            className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
          <select value={briefForm.tone}
            onChange={e => setBriefForm(s => ({ ...s, tone: e.target.value }))}
            className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm">
            <option value="minimal">Minimal / Reduziert</option>
            <option value="warm">Warm / Persönlich</option>
            <option value="professional">Professional / Business</option>
            <option value="playful">Verspielt / Bunt</option>
          </select>
          <div className="flex gap-2">
            <button onClick={submitBrief} disabled={busy || !briefForm.title.trim()}
              className="flex-1 px-3 py-2 bg-cyan-500/30 hover:bg-cyan-500/40 disabled:opacity-50 text-white text-sm rounded-lg border border-cyan-500/40">
              {busy ? 'Starte…' : 'Starten (50 Credits)'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-lg border border-white/10">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
