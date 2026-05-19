import { supabase } from './supabase'

export async function fetchUserKeys() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('llm_api_key, llm_base_url, llm_model, groq_api_key, huggingface_key, resend_api_key')
    .eq('id', user.id)
    .single()
  return data ?? {}
}

export async function saveUserKey(field, value) {
  const ALLOWED = new Set(['llm_api_key','llm_base_url','llm_model','groq_api_key','huggingface_key','resend_api_key'])
  if (!ALLOWED.has(field)) throw new Error('Unbekanntes Feld')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  const update = {}
  update[field] = value || null
  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) throw error
}

export async function testKey(field, value) {
  if (!value) return { ok: false, message: 'Kein Key' }
  try {
    if (field === 'huggingface_key') {
      const r = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${value}` }
      })
      if (!r.ok) return { ok: false, message: `HuggingFace ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'resend_api_key') {
      const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${value}` }
      })
      if (!r.ok) return { ok: false, message: `Resend ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    return { ok: true, message: 'gespeichert (nicht getestet)' }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}
