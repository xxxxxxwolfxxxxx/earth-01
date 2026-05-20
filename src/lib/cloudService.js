import { supabase } from './supabase'

export async function fetchCloudStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('cloud_provider, gdrive_folder_id, github_gist_id, rag_sources')
    .eq('id', user.id)
    .single()
  const { count } = await supabase
    .from('notes_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  return { ...(data ?? {}), indexedCount: count ?? 0 }
}

export async function callOauthCloud(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')
  const url = import.meta.env.VITE_SUPABASE_URL
  const r = await fetch(`${url}/functions/v1/oauth-cloud`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

export async function setRagSources(sources) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('profiles').update({ rag_sources: sources }).eq('id', user.id)
}

// ─── Briefing-Subscription ───
export async function fetchBriefing() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('briefing_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return data
}

export async function saveBriefing(sub) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('briefing_subscriptions').upsert({
    user_id: user.id,
    hour: sub.hour ?? 8,
    minute: sub.minute ?? 0,
    timezone: sub.timezone ?? 'Europe/Berlin',
    city: sub.city ?? null,
    include_weather: sub.include_weather ?? true,
    include_reminders: sub.include_reminders ?? true,
    include_mood: sub.include_mood ?? true,
    include_habits: sub.include_habits ?? true,
    active: sub.active ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Wenn Stadt gesetzt: Standort fürs Live-Earth ableiten.
  if (sub.city && sub.city.trim()) {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(sub.city.trim())}&count=1&language=de`)
      const j = await r.json()
      const p = j.results?.[0]
      if (p) {
        await supabase.from('profiles').update({
          home_lat: p.latitude, home_lon: p.longitude, home_city: p.name,
        }).eq('id', user.id)
      }
    } catch { /* silent */ }
  }
}

export async function deleteBriefing() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('briefing_subscriptions').delete().eq('user_id', user.id)
}

// ─── Bot-Persona ───
export async function fetchPersona() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('bot_name, bot_role, bot_tone, bot_extra')
    .eq('id', user.id)
    .single()
  return data
}

export async function uploadFile(file) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')
  const text = await file.text()
  const url = import.meta.env.VITE_SUPABASE_URL
  const r = await fetch(`${url}/functions/v1/ingest-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ text, filename: file.name }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

export async function savePersona(p) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('profiles').update({
    bot_name:  p.bot_name?.trim() || null,
    bot_role:  p.bot_role?.trim() || null,
    bot_tone:  p.bot_tone?.trim() || null,
    bot_extra: p.bot_extra?.trim() || null,
  }).eq('id', user.id)
}

// ─── Schwarm-Donation ───
export async function fetchDonateSettings() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles')
    .select('donate_tokens, donate_threshold, donate_show_credit, swarm_jobs_today')
    .eq('id', user.id).single()
  return data
}

export async function saveDonateSettings(s) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login')
  await supabase.from('profiles').update({
    donate_tokens: !!s.donate_tokens,
    donate_threshold: Math.min(90, Math.max(10, s.donate_threshold ?? 30)),
    donate_show_credit: !!s.donate_show_credit,
  }).eq('id', user.id)
}

export async function fetchMyContributions() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase.from('article_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id).eq('status', 'done')
  return count ?? 0
}

// ─── Phase 4: Job-Wirtschaft ───
export async function fetchWorkStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles')
    .select('bot_at_work, bot_work_started_at, job_credits, jobs_done_total')
    .eq('id', user.id).single()
  return data
}

export async function setBotAtWork(active) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login')
  await supabase.from('profiles').update({
    bot_at_work: !!active,
    bot_work_started_at: active ? new Date().toISOString() : null,
  }).eq('id', user.id)
}

export async function fetchMyMammothTasks() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('mammoth_tasks')
    .select('id, task_type, title, status, progress, result_url, created_at, completed_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function startMammothWebsite(brief) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Login')
  const url = import.meta.env.VITE_SUPABASE_URL
  const r = await fetch(`${url}/functions/v1/start-mammoth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ task_type: 'website', brief }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

export async function fetchCommunityPool() {
  const { data } = await supabase.from('community_pool')
    .select('credits_balance, total_collected, updated_at')
    .eq('id', 1).single()
  return data
}
