import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Key, Send, Sprout, Zap, Network, BookOpen, LogIn, CheckCircle2,
  Database, Cloud, Sparkles, Activity, Briefcase, Home as HomeIcon, Coins, Download, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchWorkStatus, setBotAtWork, fetchMyMammothTasks, startMammothWebsite, setMaxJobsPerDay,
  fetchAllLlmKeys, swapActiveLlm } from '../lib/cloudService'
import { detectProvider } from '../lib/keyService'

// Bekannte Free-Tier-Tageslimits pro LLM-Provider (Requests pro Tag).
// Zeigen dem User, wieviel "Luft" sein API-Budget hat. Quellen: Provider-Docs Stand 2026-05.
const PROVIDER_DAILY_LIMITS = {
  Groq:        { rpd: 14400, note: '30 Req/Min · sehr großzügiges Free-Tier' },
  OpenRouter:  { rpd: 50,    note: '50 Req/Tag im Free-Tier (sk-or-…:free Modelle)' },
  'NVIDIA NIM':{ rpd: 1000,  note: '1000 Credits/Monat · ca. 30 pro Tag empfohlen' },
  OpenAI:      { rpd: null,  note: 'Pay-as-you-go · kein hartes Tageslimit, aber kostet' },
  Anthropic:   { rpd: null,  note: 'Pay-as-you-go · achte auf deine Rechnung' },
}
import { getRank, computeAchievements } from '../lib/ranks'

export default function BotProfile() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [skills, setSkills] = useState([])
  const [allSkills, setAllSkills] = useState([])
  const [usage, setUsage] = useState([])
  const [contributions, setContributions] = useState(0)
  const [mammothTasks, setMammothTasks] = useState([])
  const [referralCount, setReferralCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dailyMsg, setDailyMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const q = (p) => p.then(r => r).catch(() => ({ data: null, count: 0 }))
    Promise.all([
      q(supabase.from('profiles').select(`
        bot_name, bot_role, bot_tone, bot_extra, bot_avatar, bot_username,
        telegram_bot_token, telegram_chat_id, telegram_linked_at,
        cloud_provider, home_city, created_at,
        llm_api_key, huggingface_key, elevenlabs_key, resend_api_key, whisper_key,
        swarm_jobs_today,
        bot_at_work, jobs_done_total, job_credits,
        referral_code, referred_by, bonus_credits_earned, last_daily_credit_at,
        onboarding_dismissed
      `).eq('id', user.id).single()),
      q(supabase.from('user_skills').select(`
        skill_id, unlocked_at,
        skills(id, name, icon, path)
      `).eq('user_id', user.id).order('unlocked_at', { ascending: false })),
      q(supabase.from('skill_usage_log').select('skill_id, count, date')
        .eq('user_id', user.id).order('date', { ascending: false }).limit(30)),
      q(supabase.from('article_jobs').select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id).eq('status', 'done')),
      q(supabase.from('skills').select('id, path').limit(200)),
      q(supabase.from('mammoth_tasks').select('id, status').eq('user_id', user.id)),
      q(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', user.id)),
    ]).then(([p, s, u, c, skAll, mt, rc]) => {
      setReferralCount(rc.count ?? 0)
      setProfile(p.data ?? null)
      setSkills(s.data ?? [])
      setUsage(u.data ?? [])
      setContributions(c.count ?? 0)
      setAllSkills(skAll.data ?? [])
      setMammothTasks(mt.data ?? [])
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [user])

  // Hooks MÜSSEN vor jedem early-return aufgerufen werden (Rules of Hooks)
  const topSkills = useMemo(() => {
    const map = new Map()
    for (const u of usage) {
      map.set(u.skill_id, (map.get(u.skill_id) ?? 0) + (u.count ?? 0))
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [usage])

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

  // Usage-Stats: Gesamt (topSkills wird oben memoized berechnet)
  const totalUses = usage.reduce((sum, u) => sum + (u.count ?? 0), 0)

  const botName = profile?.bot_name || 'Dein Bot'
  const { rank, next, progress } = getRank(skills.length)

  // Boni-System
  const bonusEarned = Number(profile?.bonus_credits_earned ?? 0)
  const bonusCapLeft = Math.max(0, 50 - bonusEarned)
  const refCode = profile?.referral_code
  const refUrl = refCode ? `${window.location.origin}/?ref=${refCode}` : ''
  const lastDaily = profile?.last_daily_credit_at ? new Date(profile.last_daily_credit_at).getTime() : 0
  const dailyAvailable = (Date.now() - lastDaily) > 20 * 60 * 60 * 1000 && bonusCapLeft > 0

  async function claimDaily() {
    const { data, error } = await supabase.rpc('claim_daily_credit', { p_user_id: user.id })
    if (error) { setDailyMsg('Konnte nicht eingelöst werden'); return }
    const granted = Number(data?.granted ?? 0)
    if (granted > 0) {
      setDailyMsg(`+${granted} Credit eingebucht`)
      // Profile lokal aktualisieren
      setProfile(p => ({
        ...p,
        job_credits: Number(p.job_credits ?? 0) + granted,
        bonus_credits_earned: Number(p.bonus_credits_earned ?? 0) + granted,
        last_daily_credit_at: new Date().toISOString(),
      }))
    } else {
      setDailyMsg('Morgen wieder verfügbar')
    }
    setTimeout(() => setDailyMsg(''), 3500)
  }

  async function copyRefLink() {
    try {
      await navigator.clipboard.writeText(refUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const { earned, open } = computeAchievements({
    profile,
    userSkills: skills.map(s => ({ skill_id: s.skill_id, unlocked_at: s.unlocked_at })),
    allSkills,
    usage,
    mammothTasks,
  })

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <EditableHeader profile={profile} setProfile={setProfile} botName={botName} />


      {/* Rang-Card */}
      <section className="mb-8 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
        <div className="flex items-center gap-4">
          <div className="text-5xl shrink-0">{rank.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-0.5">Aktueller Rang</div>
            <div className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">{rank.name}</div>
            <div className="text-xs text-gray-400 italic mt-0.5">„{rank.quip}"</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Skills</div>
            <div className="font-display text-2xl font-bold text-amber-200">{skills.length}</div>
          </div>
        </div>
        {next ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
              <span>Nächster Rang: <span className="text-white font-medium">{next.emoji} {next.name}</span></span>
              <span className="font-mono">{skills.length} / {next.min}</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-emerald-300 text-center">
            🏆 Maximalrang erreicht — du bist die Spitze der Earth-0.1-Pyramide.
          </div>
        )}
      </section>

      {/* Ehrenabzeichen */}
      {(earned.length > 0 || open.length > 0) && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-white text-lg font-bold m-0">Ehrenabzeichen</h2>
            <span className="text-xs text-gray-500">{earned.length} / {earned.length + open.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {earned.map(a => (
              <div key={a.id} title={a.quip}
                   className="p-3 rounded-lg border border-amber-400/40 bg-amber-500/10 flex items-start gap-2">
                <span className="text-2xl shrink-0">{a.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-100 leading-tight">{a.name}</div>
                  <div className="text-[10px] text-amber-200/70 leading-snug mt-0.5">{a.quip}</div>
                </div>
              </div>
            ))}
            {open.map(a => (
              <div key={a.id} title={a.quip}
                   className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex items-start gap-2 opacity-50">
                <span className="text-2xl shrink-0 grayscale">{a.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-300 leading-tight">{a.name}</div>
                  <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{a.quip}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Boni + Referral */}
      <section className="mb-8 p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-emerald-500/[0.03]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-white text-lg font-bold m-0">Guthaben & Boni</h2>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-300 font-display leading-none">
              <Coins className="inline w-5 h-5 mb-0.5 mr-1" />
              {Number(profile?.job_credits ?? 0).toFixed(1)}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Job-Credits</div>
          </div>
        </div>

        <div className="text-xs text-gray-400 mb-4">
          Boni-Cap: <span className="text-amber-200 font-mono">{bonusEarned} / 50</span> verbraucht.
          {bonusCapLeft > 0
            ? <> Du kannst dir noch {bonusCapLeft} Credits über Boni sichern. Danach nur noch durch echte Schwarm-Arbeit.</>
            : <> Cap erreicht — ab jetzt verdient dein Bot Credits nur noch durch echte Jobs.</>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Daily Drip */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📅</span>
              <span className="text-sm font-semibold text-white">Daily-Bonus</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">+1 Credit pro Tag. 20-Std-Cooldown.</p>
            <button
              onClick={claimDaily}
              disabled={!dailyAvailable}
              className="w-full px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-white/5 disabled:text-gray-500 text-amber-200 text-sm font-semibold rounded-lg border border-amber-500/30 disabled:border-white/10 transition"
            >
              {dailyAvailable ? 'Heute einsammeln' : (bonusCapLeft === 0 ? 'Boni-Cap erreicht' : 'Heute schon kassiert')}
            </button>
            {dailyMsg && <div className="text-[11px] text-emerald-300 mt-2">{dailyMsg}</div>}
          </div>

          {/* Referral */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🤝</span>
              <span className="text-sm font-semibold text-white">Freunde einladen</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Pro Freund mit fertigem Setup: +5 Credits für euch beide.{' '}
              <span className="text-amber-200">{referralCount} / 10</span> eingeladen.
            </p>
            {refCode ? (
              <button
                onClick={copyRefLink}
                className="w-full px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-mono rounded-lg border border-emerald-500/30 transition truncate"
                title={refUrl}
              >
                {copied ? '✓ Kopiert!' : refUrl.replace(/^https?:\/\//, '')}
              </button>
            ) : (
              <div className="text-xs text-gray-500">Code wird geladen…</div>
            )}
          </div>
        </div>
      </section>

      {/* Stats-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Skills" value={skills.length} icon={Network} color="purple" />
        <StatCard label="Aufrufe gesamt" value={totalUses} icon={Activity} color="blue" />
        <StatCard label="Schwarm-Beiträge" value={contributions} icon={Sprout} color="emerald" />
        <StatCard label="Jobs heute" value={`${profile?.swarm_jobs_today ?? 0} / ${profile?.max_jobs_per_day ?? 10}`} icon={Zap} color="amber" />
      </div>

      {/* Aktive Services */}
      <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
        <h2 className="font-display text-white text-lg font-bold mb-3">Verknüpfte Dienste</h2>
        <div className="flex flex-wrap gap-2">
          <ServiceChip ok={!!profile?.llm_api_key}        label="Sprachmodell" icon={Sparkles} />
          <ServiceChip ok={!!profile?.telegram_bot_token} label={profile?.telegram_chat_id ? 'Telegram aktiv' : 'Telegram (kein /start)'} icon={Send} />
          <ServiceChip ok={!!profile?.huggingface_key}    label="HuggingFace"  icon={Sparkles} />
          <ServiceChip ok={!!profile?.elevenlabs_key}     label="ElevenLabs"   icon={Sparkles} />
          <ServiceChip ok={!!profile?.resend_api_key}     label="Resend Mail"  icon={Sparkles} />
          <ServiceChip ok={!!profile?.cloud_provider}     label={profile?.cloud_provider === 'gdrive' ? 'Drive' : profile?.cloud_provider === 'gist' ? 'Gist' : 'Cloud'} icon={Cloud} />
          <ServiceChip ok={!!profile?.bot_at_work}        label={profile?.bot_at_work ? 'Bot arbeitet' : 'Bot zuhause'} icon={Briefcase} />
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

// Vorschläge wenn der User auf den Avatar klickt. Kann jedes Emoji eintippen
// oder eines auswählen.
const AVATAR_SUGGESTIONS = ['🤖', '👽', '🦊', '🐧', '🦉', '🦄', '🐼', '🦖', '🧞', '🧙', '🦸', '🧑‍🚀', '🐙', '🦋', '🐝', '🌟', '🔮', '⚡', '🎩', '🍀']

function EditableHeader({ profile, setProfile, botName }) {
  const [editName, setEditName] = useState(false)
  const [showAvatar, setShowAvatar] = useState(false)
  const [nameVal, setNameVal] = useState(botName)
  const [busy, setBusy] = useState(false)
  const avatar = profile?.bot_avatar || '🤖'

  async function saveName() {
    const v = nameVal.trim().slice(0, 60)
    if (!v || v === botName) { setEditName(false); return }
    setBusy(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const { error } = await supabase.from('profiles').update({ bot_name: v }).eq('id', userId)
    if (!error) setProfile(p => ({ ...p, bot_name: v }))
    setBusy(false)
    setEditName(false)
  }

  async function saveAvatar(emoji) {
    setBusy(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    const { error } = await supabase.from('profiles').update({ bot_avatar: emoji }).eq('id', userId)
    if (!error) setProfile(p => ({ ...p, bot_avatar: emoji }))
    setBusy(false)
    setShowAvatar(false)
  }

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        {/* Avatar (klickbar) */}
        <button
          onClick={() => setShowAvatar(s => !s)}
          className="text-5xl shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center bg-nebula-500/20 hover:bg-nebula-500/30 border border-nebula-500/40 hover:border-nebula-400 transition cursor-pointer relative group"
          title="Avatar ändern"
        >
          {avatar}
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-nebula-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition">✎</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-xs mb-2">
            <Bot className="w-3 h-3" /> Mein Bot
          </div>

          {/* Name (klickbar) */}
          {editName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') { setNameVal(botName); setEditName(false) }
              }}
              disabled={busy}
              maxLength={60}
              className="font-display text-3xl sm:text-4xl font-bold text-white bg-white/5 border border-nebula-400/50 focus:border-nebula-400 rounded-lg px-2 py-1 outline-none w-full max-w-md"
            />
          ) : (
            <button
              onClick={() => { setNameVal(botName); setEditName(true) }}
              className="font-display text-3xl sm:text-4xl font-bold text-white m-0 hover:text-nebula-200 transition text-left cursor-pointer bg-transparent border-0 p-0"
              title="Namen ändern"
            >
              {botName} <span className="text-xs text-gray-500 align-middle ml-2">✎</span>
            </button>
          )}

          {profile?.bot_username && (
            <a
              href={`https://t.me/${profile.bot_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-sky-400 hover:text-sky-300 mt-1 no-underline"
            >
              @{profile.bot_username} auf Telegram öffnen ↗
            </a>
          )}
          {profile?.bot_role && <p className="text-gray-300 mt-1 text-sm">{profile.bot_role}</p>}
          {profile?.bot_tone && <p className="text-gray-500 text-xs italic mt-1">„{profile.bot_tone}"</p>}
          {profile?.home_city && <div className="text-xs text-gray-500 mt-2">📍 {profile.home_city}</div>}
        </div>
      </div>

      {/* Avatar-Picker */}
      {showAvatar && (
        <div className="mt-3 p-3 rounded-xl border border-white/10 bg-cosmos-900/80 backdrop-blur-md">
          <div className="text-xs text-gray-400 mb-2">Avatar wählen — klick eines an, oder tipp ein beliebiges Emoji unten ein.</div>
          <div className="grid grid-cols-10 gap-1.5 mb-3">
            {AVATAR_SUGGESTIONS.map(e => (
              <button
                key={e}
                onClick={() => saveAvatar(e)}
                disabled={busy}
                className={`text-2xl aspect-square rounded-lg flex items-center justify-center transition ${
                  e === avatar
                    ? 'bg-nebula-500/30 border border-nebula-400'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Eigenes Emoji eintippen + Enter…"
            maxLength={4}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                saveAvatar(e.target.value.trim())
              }
            }}
            className="w-full bg-black/40 border border-white/15 focus:border-nebula-400 rounded-lg px-3 py-2 text-white text-sm outline-none"
          />
        </div>
      )}
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
    gemeinschaft: 'Gemeinschaft',
  }
  return m[path] ?? path
}

// ─── Tageshaushalt: API-Budget transparent machen ─────────────────────

function DailyQuotaPanel({ status, onChange }) {
  const provider = detectProvider(status?.llm_api_key)?.name
  const providerLimit = provider ? PROVIDER_DAILY_LIMITS[provider] : null
  const usedToday = Number(status?.swarm_jobs_today ?? 0)
  const userCap = Number(status?.max_jobs_per_day ?? 10)
  const [localCap, setLocalCap] = useState(userCap)
  const [saving, setSaving] = useState(false)
  const [showSwitch, setShowSwitch] = useState(false)
  const [keys, setKeys] = useState({ active: null, extras: [] })

  useEffect(() => { setLocalCap(userCap) }, [userCap])

  async function loadKeys() {
    const k = await fetchAllLlmKeys()
    setKeys(k)
  }
  useEffect(() => { loadKeys() }, [status?.llm_api_key])

  async function commit(v) {
    if (v === userCap) return
    setSaving(true)
    await setMaxJobsPerDay(v).catch(() => {})
    setSaving(false)
    onChange?.()
  }

  async function pickKey(idx) {
    setSaving(true)
    await swapActiveLlm(idx).catch(() => {})
    setShowSwitch(false)
    setSaving(false)
    onChange?.()
    loadKeys()
  }

  // Empfehlung: wenn Provider bekannt, max 50% des Tages-Limits für Schwarm
  const recommended = providerLimit?.rpd ? Math.min(100, Math.floor(providerLimit.rpd * 0.5)) : 30
  const isAboveRec = localCap > recommended
  const capPct = providerLimit?.rpd ? Math.min(100, Math.round(100 * localCap / providerLimit.rpd)) : null

  const hasOtherKeys = keys.extras.length > 0

  return (
    <div className="mb-4 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm font-medium text-white inline-flex items-center gap-2">
          📊 Tageshaushalt {provider && <span className="text-[10px] uppercase tracking-wider text-gray-500">· {provider}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400 font-mono">{usedToday} / {localCap} heute</div>
          {hasOtherKeys && (
            <button
              onClick={() => setShowSwitch(s => !s)}
              className="text-[11px] text-cyan-300 hover:text-white underline decoration-dotted"
            >
              Provider wechseln ↕
            </button>
          )}
        </div>
      </div>

      {/* Provider-Auswahl */}
      {showSwitch && (
        <div className="mb-3 p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
          <div className="text-[11px] text-gray-400 mb-2">Verfügbare LLM-Provider — Klick aktiviert</div>
          <div className="space-y-1.5">
            {keys.active && (
              <div className="flex items-center justify-between p-2 rounded bg-emerald-500/15 border border-emerald-500/40">
                <div className="min-w-0">
                  <div className="text-xs text-white font-medium">
                    ✓ {detectProvider(keys.active.key)?.name ?? 'Aktiv'}
                    {keys.active.label && <span className="text-gray-400 ml-2">— {keys.active.label}</span>}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {PROVIDER_DAILY_LIMITS[detectProvider(keys.active.key)?.name]?.rpd ?? '—'} Req/Tag · {keys.active.model}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-300">Aktiv</span>
              </div>
            )}
            {keys.extras.map((k, i) => {
              const p = detectProvider(k.key)?.name
              const lim = PROVIDER_DAILY_LIMITS[p]
              return (
                <button key={i} onClick={() => pickKey(i)} disabled={saving}
                  className="w-full flex items-center justify-between p-2 rounded bg-white/[0.03] border border-white/10 hover:border-cyan-400/40 hover:bg-white/5 transition text-left">
                  <div className="min-w-0">
                    <div className="text-xs text-white font-medium">
                      {p || 'Unbekannt'}
                      {k.label && <span className="text-gray-400 ml-2">— {k.label}</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {lim?.rpd ?? '—'} Req/Tag · {k.model || '?'}
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-300">→ aktivieren</span>
                </button>
              )
            })}
          </div>
          <Link to="/keys" className="block text-[11px] text-cyan-300 hover:text-white mt-3 no-underline">
            + Weiteren Provider hinzufügen (auf /keys)
          </Link>
        </div>
      )}

      {/* Provider-Info */}
      {providerLimit ? (
        <div className="text-[11px] text-gray-400 mb-3">
          Free-Tier-Limit: <span className="text-white font-mono">{providerLimit.rpd ? `${providerLimit.rpd} Req/Tag` : 'kein hartes Limit'}</span>.{' '}
          {providerLimit.note}
        </div>
      ) : (
        <div className="text-[11px] text-amber-300 mb-3">
          Kein LLM-Key erkannt — schalt dir erst einen frei, sonst kann dein Bot keine LLM-Jobs machen.
        </div>
      )}

      {/* Visualisierung: Belegt vs Frei vs Eigene Reserve */}
      {providerLimit?.rpd && (
        <div className="mb-3">
          <div className="flex h-3 rounded-full overflow-hidden bg-white/5 border border-white/10">
            {/* Verbraucht */}
            <div
              className="h-full bg-amber-500"
              style={{ width: `${Math.min(100, 100 * usedToday / providerLimit.rpd)}%` }}
              title={`Heute schon verbraucht: ${usedToday}`}
            />
            {/* Cap-Rest fürs Schwarm-Budget */}
            <div
              className="h-full bg-cyan-500/60"
              style={{ width: `${Math.max(0, 100 * (localCap - usedToday) / providerLimit.rpd)}%` }}
              title={`Schwarm-Reserve: ${Math.max(0, localCap - usedToday)}`}
            />
            {/* Eigene Reserve = Rest */}
            <div className="h-full flex-1 bg-emerald-500/40" title="Deine eigene Reserve (Chat, Skills, RAG)" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>🟡 Schwarm heute verbraucht</span>
            <span>🔵 Schwarm-Reserve</span>
            <span>🟢 Deine eigene Reserve</span>
          </div>
        </div>
      )}

      {/* Slider */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
          <span>Schwarm-Jobs pro Tag erlauben:</span>
          <span className={`font-mono font-bold ${isAboveRec ? 'text-amber-300' : 'text-white'}`}>
            {localCap}{capPct !== null ? ` · ${capPct}% deines Tages-Limits` : ''}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(100, recommended * 2)}
          step={1}
          value={localCap}
          onChange={(e) => setLocalCap(Number(e.target.value))}
          onMouseUp={(e) => commit(Number(e.target.value))}
          onTouchEnd={(e) => commit(Number(e.target.value))}
          onKeyUp={(e) => commit(localCap)}
          className="w-full accent-cyan-400"
          disabled={saving}
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>0 (nur eigene Projekte)</span>
          <span>Empfohlen: {recommended}</span>
          <span>{Math.max(100, recommended * 2)}</span>
        </div>
        {isAboveRec && (
          <div className="text-[11px] text-amber-300 mt-2">
            ⚠ Du gehst über die 50%-Empfehlung. Behalte deine eigene Nutzung im Auge — wenn dein Bot zu viel für andere arbeitet, kannst du ihn selbst nicht mehr nutzen.
          </div>
        )}
        {localCap === 0 && (
          <div className="text-[11px] text-emerald-300 mt-2">
            🛡️ Solo-Modus: Bot macht nur deine eigenen Mammut-Jobs, keine fremden.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Phase 4: WorkSection (Bot-Status + Mammutaufgaben) ─────────────────

function WorkSection() {
  const [status, setStatus] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [prompt, setPrompt] = useState('')
  const [offer, setOffer] = useState(null) // {title, summary, jobs, total_credits}
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

  async function requestOffer() {
    if (prompt.trim().length < 8) return
    setBusy(true); setMsg(''); setOffer(null)
    try {
      const o = await (await import('../lib/cloudService.js')).estimateProject(prompt.trim())
      setOffer(o)
    } catch (e) { setMsg(`Angebot fehlgeschlagen: ${e.message}`) }
    setBusy(false)
  }

  async function confirmOffer() {
    if (!offer) return
    setBusy(true); setMsg('')
    try {
      const r = await (await import('../lib/cloudService.js')).startProject(prompt.trim(), offer)
      setMsg(r.paused
        ? `⏸️ Projekt angelegt mit ${r.job_count} Jobs — pausiert, weil du nur 0 Credits hast. Sammelt sich von selbst weiter auf.`
        : `🚀 Projekt läuft! ${r.job_count} Jobs in der Pipeline.`)
      setPrompt(''); setOffer(null); setShowForm(false)
      await reload()
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  const credits = Number(status.job_credits ?? 0)

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

      {/* Tageshaushalt — API-Budget für Schwarm-Jobs */}
      <DailyQuotaPanel status={status} onChange={reload} />

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
        <button onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 rounded-xl border border-cyan-500/30 transition flex items-center justify-center gap-2 text-sm font-medium">
          🌐 Neues Projekt beauftragen
        </button>
      )}

      {showForm && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-3">
          <div className="text-sm text-white font-medium">🌐 Was soll dein Bot bauen?</div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            placeholder='Beschreib dein Projekt in eigenen Worten. Beispiel: „Eine kleine Portfolio-Website für mich als freier Fotograf. Hero mit Bild, Über mich, 3 Beispielarbeiten, Kontakt."'
            className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 resize-y"
          />

          {!offer && (
            <div className="flex gap-2">
              <button onClick={requestOffer} disabled={busy || prompt.trim().length < 8}
                className="flex-1 px-3 py-2 bg-cyan-500/30 hover:bg-cyan-500/40 disabled:opacity-50 text-white text-sm rounded-lg border border-cyan-500/40 inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>📋 Angebot erstellen lassen</>}
              </button>
              <button onClick={() => { setShowForm(false); setPrompt(''); setOffer(null) }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-lg border border-white/10">
                Abbrechen
              </button>
            </div>
          )}

          {offer && (
            <div className="p-3 rounded-lg bg-black/30 border border-cyan-400/30">
              <div className="text-sm font-display font-bold text-white mb-1">📋 {offer.title}</div>
              <p className="text-xs text-gray-300 mb-3">{offer.summary}</p>
              <div className="text-[10px] uppercase tracking-wider text-cyan-300/70 mb-1">Job-Plan</div>
              <ol className="space-y-1 mb-3 max-h-48 overflow-auto">
                {offer.jobs.map((j, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span>
                    <span className="flex-1 text-gray-300">{j.what}</span>
                    <span className="text-amber-300 font-mono shrink-0">{j.credits} ¢</span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/30 mb-3">
                <span className="text-xs text-amber-100 font-medium">Gesamtkosten</span>
                <span className="text-amber-200 font-display font-bold text-lg">
                  <Coins className="inline w-4 h-4 mb-0.5 mr-1" />
                  {offer.total_credits}
                </span>
              </div>
              {credits < offer.total_credits && (
                <div className="text-[11px] text-blue-200 bg-blue-500/10 border border-blue-500/30 rounded p-2 mb-3">
                  Du hast aktuell {credits.toFixed(0)} Credits — nicht genug für das ganze Projekt.
                  Kein Problem: <strong>der Bot fängt an</strong> und pausiert wenn die Credits leer sind.
                  Sobald du wieder Credits hast (Skills, Daily, Referrals oder Jobs), läuft's von selbst weiter.
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={confirmOffer} disabled={busy}
                  className="flex-1 px-3 py-2 bg-cyan-500/30 hover:bg-cyan-500/40 disabled:opacity-50 text-white text-sm rounded-lg border border-cyan-500/40 font-semibold">
                  {busy ? 'Starte…' : '✓ Projekt beauftragen'}
                </button>
                <button onClick={() => setOffer(null)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-lg border border-white/10">
                  Anderes Angebot
                </button>
              </div>
              <div className="text-[10px] text-gray-500 mt-2 text-center">
                Generiert von {offer.generated_by === 'llm' ? 'deinem LLM' : 'unserer Heuristik'}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
