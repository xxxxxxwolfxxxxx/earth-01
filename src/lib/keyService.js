import { supabase } from './supabase'

// Erkennt anhand des Key-Prefix den passenden Provider + Default-Model.
// Wird beim Speichern von llm_api_key automatisch angewendet.
export function detectProvider(apiKey) {
  if (!apiKey) return null
  const k = apiKey.trim()
  if (k.startsWith('gsk_')) return {
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  }
  if (k.startsWith('sk-or-')) return {
    name: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
  }
  if (k.startsWith('nvapi-')) return {
    name: 'NVIDIA NIM',
    base_url: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  }
  if (k.startsWith('sk-')) return {
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  }
  return null
}

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

  // Beim Setzen von llm_api_key: Provider erkennen und URL+Model mitsetzen
  let providerInfo = null
  if (field === 'llm_api_key' && value) {
    providerInfo = detectProvider(value)
    if (providerInfo) {
      update.llm_base_url = providerInfo.base_url
      update.llm_model = providerInfo.model
    }
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) throw error
  return providerInfo
}

export async function testKey(field, value) {
  if (!value) return { ok: false, message: 'Kein Key' }
  try {
    if (field === 'llm_api_key') {
      const p = detectProvider(value)
      if (!p) return { ok: true, message: 'gespeichert (Provider unbekannt)' }
      // Optional: Live-Test via /models-Endpoint wo verfügbar
      try {
        const r = await fetch(`${p.base_url}/models`, {
          headers: { Authorization: `Bearer ${value}` }
        })
        if (r.ok) return { ok: true, message: `${p.name} OK (Modell ${p.model})` }
        return { ok: false, message: `${p.name} ${r.status}` }
      } catch {
        return { ok: true, message: `gespeichert als ${p.name}` }
      }
    }
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
