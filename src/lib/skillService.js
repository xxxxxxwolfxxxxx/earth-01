import { supabase } from './supabase'

export async function fetchSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchSkill(id) {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchUserSkills() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('user_skills')
    .select('skill_id, unlocked_at')
    .eq('user_id', user.id)
  return data ?? []
}

export async function fetchGlossary() {
  const { data, error } = await supabase
    .from('glossary')
    .select('*')
  if (error) throw error
  return data ?? []
}

export async function fetchGlossaryEntry(key) {
  const { data } = await supabase
    .from('glossary')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  return data
}

// Lesson-Session-Management
export async function startLesson(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  // Bestehende offene abandonen
  await supabase
    .from('lesson_sessions')
    .update({ state: 'abandoned' })
    .eq('user_id', user.id)
    .in('state', ['concept', 'task'])
  // Neue erstellen
  const { data, error } = await supabase
    .from('lesson_sessions')
    .insert({ user_id: user.id, skill_id: skillId, state: 'concept' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function advanceLesson(sessionId, newState) {
  const { error } = await supabase
    .from('lesson_sessions')
    .update({ state: newState, completed_at: newState === 'verified' ? new Date().toISOString() : null })
    .eq('id', sessionId)
  if (error) throw error
}

export async function findOpenLesson(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('lesson_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('skill_id', skillId)
    .in('state', ['concept', 'task'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Direkter Browser-Skill-Unlock (für Skripte ohne Server-Verifikation)
export async function markSkillUnlocked(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase
    .from('user_skills')
    .upsert({ user_id: user.id, skill_id: skillId }, { onConflict: 'user_id,skill_id' })
}

// Realtime auf user_skills lauschen (für Auto-Refresh nach Telegram-Verifikation)
export function subscribeUserSkills(onChange) {
  const channel = supabase
    .channel('user-skills-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_skills' }, (payload) => {
      onChange(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
