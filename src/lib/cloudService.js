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
}

export async function deleteBriefing() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('briefing_subscriptions').delete().eq('user_id', user.id)
}
