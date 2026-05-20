import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Key, Send, Network, ArrowRight, X, CheckCircle2, Sparkles, Briefcase } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Onboarding-Status berechnen: wo steht der User?
function deriveStep(profile, unlockedCount) {
  if (!profile) return null
  if (!profile.llm_api_key) return 'llm'
  if (!profile.telegram_bot_token || !profile.telegram_webhook_secret) return 'telegram'
  if (unlockedCount === 0) return 'first_skill'
  if (!profile.bot_at_work && (profile.jobs_done_total ?? 0) === 0) return 'teamwork'
  return 'done'
}

const STEP_META = {
  llm: {
    icon: Key,
    title: 'Schritt 1 — Hol dir einen kostenlosen LLM-Key',
    sub: 'Empfohlen: Groq. Kein Kreditkarte nötig, ~14.000 Tokens/Min gratis.',
    to: '/keys',
    cta: 'Zur Schlüssel-Zentrale',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    accent: 'text-blue-300',
  },
  telegram: {
    icon: Send,
    title: 'Schritt 2 — Verbinde deinen Telegram-Bot',
    sub: 'Eigenen Bot in 3 Min beim @BotFather erstellen, Token einfügen, Webhook automatisch.',
    to: '/keys',
    cta: 'Bot verbinden',
    color: 'from-sky-500/20 to-blue-500/20 border-sky-500/30',
    accent: 'text-sky-300',
  },
  first_skill: {
    icon: Network,
    title: 'Schritt 3 — Schalt deinen ersten Skill frei',
    sub: 'Such dir im Tech-Baum eine Fähigkeit, lies das Konzept, probier sie aus. Empfehlung: Hash-Tools oder Würfel.',
    to: '/tech-tree',
    cta: 'Zum Tech-Baum',
    color: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
    accent: 'text-purple-300',
  },
  teamwork: {
    icon: Briefcase,
    title: 'Schritt 4 — Schick deinen Bot zur Arbeit',
    sub: 'Pro Job 0.9 Credits verdienen, 50 sammeln und eine eigene Website kollektiv bauen lassen. „/arbeiten" an deinen Bot.',
    to: '/bot',
    cta: 'Zum Bot-Profil',
    color: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/30',
    accent: 'text-emerald-300',
  },
  done: {
    icon: Sparkles,
    title: 'Setup abgeschlossen — dein Bot ist startklar',
    sub: 'Du nutzt jetzt deinen eigenen KI-Agenten. Schließen, und du bekommst diesen Hinweis nicht mehr.',
    to: '/tech-tree',
    cta: 'Weitere Skills freischalten',
    color: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
    accent: 'text-emerald-300',
  },
}

// Zeige Banner nicht auf diesen Routen
const HIDE_ON = ['/login', '/auth/callback']

export default function OnboardingBanner() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [dismissedLocally, setDismissedLocally] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) { setLoaded(false); return }
    let cancelled = false
    Promise.all([
      supabase.from('profiles').select('llm_api_key, telegram_bot_token, telegram_webhook_secret, onboarding_dismissed, bot_at_work, jobs_done_total').eq('id', user.id).single(),
      supabase.from('user_skills').select('skill_id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([p, u]) => {
      if (cancelled) return
      setProfile(p.data ?? null)
      setUnlockedCount(u.count ?? 0)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [user])

  async function dismiss() {
    setDismissedLocally(true)
    if (user) {
      await supabase.from('profiles').update({ onboarding_dismissed: true }).eq('id', user.id)
    }
  }

  if (loading || !user || !loaded) return null
  if (HIDE_ON.includes(location.pathname)) return null
  if (profile?.onboarding_dismissed || dismissedLocally) return null

  const step = deriveStep(profile, unlockedCount)
  if (!step) return null
  const meta = STEP_META[step]
  const Icon = meta.icon

  // Stepper-Punkte
  const steps = ['llm', 'telegram', 'first_skill', 'teamwork']
  const currentIdx = steps.indexOf(step)
  const allDone = step === 'done'

  return (
    <div className="fixed top-16 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-2 pointer-events-auto">
        <div className={`rounded-xl border bg-gradient-to-br ${meta.color} backdrop-blur-md shadow-lg shadow-black/30 px-4 py-3 flex items-center gap-3`}>
          <Icon className={`w-5 h-5 ${meta.accent} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-display font-semibold text-sm">{meta.title}</span>
              {!allDone && (
                <div className="flex items-center gap-1">
                  {steps.map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 w-4 rounded-full transition ${
                        i < currentIdx ? 'bg-emerald-400' : i === currentIdx ? `bg-white/80` : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>
              )}
              {allDone && (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              )}
            </div>
            <div className="text-xs text-gray-300 mt-0.5 leading-snug truncate">
              {meta.sub}
            </div>
          </div>
          <Link
            to={meta.to}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg whitespace-nowrap no-underline transition"
          >
            {meta.cta} <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            onClick={dismiss}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition shrink-0"
            title="Hinweis ausblenden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
