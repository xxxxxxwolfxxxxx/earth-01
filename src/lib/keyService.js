import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────
// Service-Katalog: alle unterstützten API-Keys an einem Ort.
// Jede Eintragung wird auf der /keys-Seite gerendert.
// ─────────────────────────────────────────────────────────────

export const SERVICE_CATALOG = [
  // ── Sprachmodelle (Chat-LLMs) ──
  {
    category: 'llm',
    field: 'llm_api_key',
    name: 'Sprachmodell-Key',
    icon: '🧠',
    placeholder: 'gsk_…   sk-or-…   nvapi-…   sk-…',
    help: 'Ein einziger Schlüssel reicht. Wir erkennen am Prefix automatisch den Anbieter.',
    links: [
      { label: 'Groq (gsk_)', url: 'https://console.groq.com/keys' },
      { label: 'NVIDIA (nvapi-)', url: 'https://build.nvidia.com' },
      { label: 'OpenRouter (sk-or-)', url: 'https://openrouter.ai/keys' },
      { label: 'OpenAI (sk-)', url: 'https://platform.openai.com/api-keys' },
    ],
    skill: 'Chat, RAG, Übersetzung, alle KI-Antworten',
  },

  // ── Audio: Spracherkennung + TTS ──
  {
    category: 'audio',
    field: 'whisper_key',
    name: 'Whisper-Key (Spracherkennung)',
    icon: '🎤',
    placeholder: 'sk-… oder gsk_…',
    help: 'Wandelt Sprachnachrichten in Text. OpenAI-Whisper oder Groq-Whisper (schneller, gratis).',
    links: [
      { label: 'Groq Whisper (empfohlen)', url: 'https://console.groq.com/keys' },
      { label: 'OpenAI Whisper', url: 'https://platform.openai.com/api-keys' },
    ],
    skill: 'Telegram-Sprachnachrichten lesen',
  },
  {
    category: 'audio',
    field: 'elevenlabs_key',
    name: 'ElevenLabs-Key (TTS)',
    icon: '🔊',
    placeholder: 'sk_…',
    help: '10.000 Zeichen/Monat gratis. Sehr natürliche Stimmen für Sprachantworten.',
    links: [
      { label: 'ElevenLabs', url: 'https://elevenlabs.io/app/settings/api-keys' },
    ],
    skill: 'Bot antwortet per Sprachnachricht',
  },

  // ── Bilder & Medien ──
  {
    category: 'media',
    field: 'huggingface_key',
    name: 'Hugging-Face-Token',
    icon: '🖼️',
    placeholder: 'hf_…',
    help: 'Gratis-Inferenz für viele OpenSource-Modelle (Bild-Gen, Embeddings, Klassifikation).',
    links: [
      { label: 'Hugging Face Tokens', url: 'https://huggingface.co/settings/tokens' },
    ],
    skill: 'Bild-Generation, Embeddings, RAG',
  },
  {
    category: 'media',
    field: 'replicate_key',
    name: 'Replicate-Token',
    icon: '🎨',
    placeholder: 'r8_…',
    help: 'Pay-as-you-go, ca. 50 Bilder gratis nach Anmeldung. Stable Diffusion, Flux, Video-Gen.',
    links: [
      { label: 'Replicate', url: 'https://replicate.com/account/api-tokens' },
    ],
    skill: 'Hochwertige Bild- und Video-Generation',
  },
  {
    category: 'media',
    field: 'stability_key',
    name: 'Stability-AI-Key',
    icon: '✨',
    placeholder: 'sk-…',
    help: '25 Credits gratis. Stable Diffusion 3, SDXL, Image-Edit.',
    links: [
      { label: 'Stability AI', url: 'https://platform.stability.ai/account/keys' },
    ],
    skill: 'Bild-Generation mit Stable Diffusion',
  },

  // ── Daten-APIs ──
  {
    category: 'data',
    field: 'openweather_key',
    name: 'OpenWeather-Key',
    icon: '🌤️',
    placeholder: '32-Zeichen-Hex',
    help: '1000 Anfragen/Tag gratis. Wetterdaten weltweit.',
    links: [
      { label: 'OpenWeather API', url: 'https://openweathermap.org/api' },
    ],
    skill: 'Wetter-Skill (genauere Daten)',
  },
  {
    category: 'data',
    field: 'deepl_key',
    name: 'DeepL-Key',
    icon: '🌐',
    placeholder: '…:fx (kostenlos) oder ohne Suffix (pro)',
    help: '500.000 Zeichen/Monat gratis. Beste deutschsprachige Übersetzung.',
    links: [
      { label: 'DeepL Free API', url: 'https://www.deepl.com/pro-api' },
    ],
    skill: 'Übersetzungs-Skill (Phase 2)',
  },
  {
    category: 'data',
    field: 'brave_search_key',
    name: 'Brave-Search-Key',
    icon: '🦁',
    placeholder: 'BSA…',
    help: '2000 Anfragen/Monat gratis. Bessere Suche als DuckDuckGo Instant Answer.',
    links: [
      { label: 'Brave Search API', url: 'https://api.search.brave.com/app/keys' },
    ],
    skill: 'Web-Suche (bessere Qualität)',
  },
  {
    category: 'data',
    field: 'newsapi_key',
    name: 'NewsAPI-Key',
    icon: '📰',
    placeholder: '32-Zeichen-Hex',
    help: '100 Anfragen/Tag gratis (Entwickler-Tier).',
    links: [
      { label: 'NewsAPI', url: 'https://newsapi.org/register' },
    ],
    skill: 'Nachrichten-Briefing (Phase 2)',
  },

  // ── Email & Push ──
  {
    category: 'notify',
    field: 'resend_api_key',
    name: 'Resend-Key (Email)',
    icon: '✉️',
    placeholder: 're_…',
    help: '3000 Mails/Monat gratis. Saubere transaktionale Mails.',
    links: [
      { label: 'Resend', url: 'https://resend.com/api-keys' },
    ],
    skill: 'Email-Versand (Phase 2)',
  },
  {
    category: 'notify',
    field: 'pushover_token',
    name: 'Pushover-Token',
    icon: '🔔',
    placeholder: 'a…',
    help: 'Einmalig 5 $, danach unbegrenzt. Push-Benachrichtigung ohne Telegram.',
    links: [
      { label: 'Pushover Apps', url: 'https://pushover.net/apps' },
    ],
    skill: 'Native Push auf Handy/Watch',
    sibling: { field: 'pushover_user', label: 'Pushover User-Key', placeholder: 'u…' },
  },

  // ── Bot-Kanal ──
  {
    category: 'bot',
    field: 'telegram_bot_token',
    name: 'Telegram-Bot-Token',
    icon: '🤖',
    placeholder: '12345:ABC-DEF…',
    help: 'Eigenen Bot bei @BotFather erstellen, Token hier eintragen. Webhook wird automatisch gesetzt.',
    links: [
      { label: 'BotFather öffnen', url: 'https://t.me/BotFather' },
      { label: 'Bot-API-Doku', url: 'https://core.telegram.org/bots' },
    ],
    skill: 'Alle Bot-Interaktionen',
  },
]

export const CATEGORIES = [
  { id: 'llm',    label: 'Sprachmodelle',     icon: '🧠', desc: 'Chat-LLMs für alle KI-Antworten' },
  { id: 'audio',  label: 'Audio',             icon: '🎙️', desc: 'Sprache-zu-Text und Text-zu-Sprache' },
  { id: 'media',  label: 'Bilder & Medien',   icon: '🎨', desc: 'Bild-, Video- und Embedding-Modelle' },
  { id: 'data',   label: 'Daten-APIs',        icon: '📊', desc: 'Wetter, Übersetzung, Suche, News' },
  { id: 'notify', label: 'Email & Push',      icon: '📨', desc: 'Benachrichtigungs-Kanäle' },
  { id: 'bot',    label: 'Bot-Kanäle',        icon: '🤖', desc: 'Telegram und zukünftige Kanäle' },
]

// ── Provider-Detection für LLM-Key (legt base_url + model automatisch fest) ──
export function detectProvider(apiKey) {
  if (!apiKey) return null
  const k = apiKey.trim()
  if (k.startsWith('gsk_'))    return { name: 'Groq',       base_url: 'https://api.groq.com/openai/v1',          model: 'llama-3.3-70b-versatile' }
  if (k.startsWith('sk-or-'))  return { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1',            model: 'meta-llama/llama-3.1-8b-instruct:free' }
  if (k.startsWith('nvapi-'))  return { name: 'NVIDIA NIM', base_url: 'https://integrate.api.nvidia.com/v1',     model: 'meta/llama-3.1-8b-instruct' }
  if (k.startsWith('sk-ant-')) return { name: 'Anthropic',  base_url: 'https://api.anthropic.com/v1',            model: 'claude-3-5-sonnet-latest' }
  if (k.startsWith('sk-'))     return { name: 'OpenAI',     base_url: 'https://api.openai.com/v1',               model: 'gpt-4o-mini' }
  return null
}

// ── Erlaubte Felder beim Speichern (Whitelist gegen Mutwilligkeit) ──
const SAVE_WHITELIST = new Set([
  'llm_api_key', 'llm_base_url', 'llm_model',
  'huggingface_key', 'resend_api_key',
  'whisper_key', 'elevenlabs_key',
  'replicate_key', 'stability_key',
  'openweather_key', 'deepl_key', 'brave_search_key', 'newsapi_key',
  'pushover_token', 'pushover_user',
  'telegram_bot_token',
])

const FETCH_COLUMNS = Array.from(SAVE_WHITELIST).join(', ')

export async function fetchUserKeys() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select(`${FETCH_COLUMNS}, telegram_webhook_secret, telegram_chat_id, telegram_linked_at`)
    .eq('id', user.id)
    .single()
  return data ?? {}
}

// ─── Telegram-Webhook-Aktionen über Edge Function ───
// action ∈ { 'register', 'test', 'unregister' }
export async function callTelegramAction(action) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const r = await fetch(`${supabaseUrl}/functions/v1/register-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`)
  return body
}

export async function saveUserKey(field, value) {
  if (!SAVE_WHITELIST.has(field)) throw new Error('Unbekanntes Feld')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  const update = {}
  update[field] = value || null

  // Beim Setzen von llm_api_key: Provider erkennen und base_url + model mitsetzen
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

export async function deleteUserKey(field) {
  return saveUserKey(field, null)
}

// ── Live-Test je nach Service ──
export async function testKey(field, value) {
  if (!value) return { ok: false, message: 'Kein Key' }
  try {
    if (field === 'llm_api_key') {
      const p = detectProvider(value)
      if (!p) return { ok: true, message: 'Gespeichert (Provider unbekannt)' }
      try {
        const r = await fetch(`${p.base_url}/models`, { headers: { Authorization: `Bearer ${value}` } })
        if (r.ok) return { ok: true, message: `${p.name} OK · Modell ${p.model}` }
        return { ok: false, message: `${p.name} antwortet ${r.status}` }
      } catch {
        return { ok: true, message: `Als ${p.name} gespeichert (CORS verhindert Live-Test)` }
      }
    }
    if (field === 'whisper_key') {
      const p = detectProvider(value)
      return { ok: true, message: p ? `Gespeichert als ${p.name}` : 'Gespeichert' }
    }
    if (field === 'huggingface_key') {
      const r = await fetch('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${value}` } })
      if (!r.ok) return { ok: false, message: `Hugging Face antwortet ${r.status}` }
      const j = await r.json().catch(() => ({}))
      return { ok: true, message: j.name ? `OK · ${j.name}` : 'OK' }
    }
    if (field === 'resend_api_key') {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${value}` } })
      if (!r.ok) return { ok: false, message: `Resend antwortet ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'replicate_key') {
      const r = await fetch('https://api.replicate.com/v1/account', { headers: { Authorization: `Token ${value}` } })
      if (!r.ok) return { ok: false, message: `Replicate antwortet ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'stability_key') {
      const r = await fetch('https://api.stability.ai/v1/user/balance', { headers: { Authorization: `Bearer ${value}` } })
      if (!r.ok) return { ok: false, message: `Stability antwortet ${r.status}` }
      const j = await r.json().catch(() => ({}))
      return { ok: true, message: j.credits !== undefined ? `OK · ${Math.round(j.credits)} Credits` : 'OK' }
    }
    if (field === 'openweather_key') {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Berlin&appid=${encodeURIComponent(value)}`)
      if (!r.ok) return { ok: false, message: `OpenWeather antwortet ${r.status}` }
      return { ok: true, message: 'OK · Berlin abgefragt' }
    }
    if (field === 'deepl_key') {
      const base = value.endsWith(':fx') ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2'
      const r = await fetch(`${base}/usage`, { headers: { Authorization: `DeepL-Auth-Key ${value}` } })
      if (!r.ok) return { ok: false, message: `DeepL antwortet ${r.status}` }
      const j = await r.json().catch(() => ({}))
      return { ok: true, message: j.character_limit ? `OK · ${j.character_count}/${j.character_limit} Zeichen` : 'OK' }
    }
    if (field === 'brave_search_key') {
      const r = await fetch('https://api.search.brave.com/res/v1/web/search?q=test', {
        headers: { 'X-Subscription-Token': value, Accept: 'application/json' },
      })
      if (!r.ok) return { ok: false, message: `Brave antwortet ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'newsapi_key') {
      const r = await fetch(`https://newsapi.org/v2/top-headlines?country=de&apiKey=${encodeURIComponent(value)}`)
      if (!r.ok) return { ok: false, message: `NewsAPI antwortet ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'elevenlabs_key') {
      const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': value } })
      if (!r.ok) return { ok: false, message: `ElevenLabs antwortet ${r.status}` }
      const j = await r.json().catch(() => ({}))
      return { ok: true, message: j.subscription?.character_count !== undefined ? `OK · ${j.subscription.character_count}/${j.subscription.character_limit}` : 'OK' }
    }
    if (field === 'telegram_bot_token') {
      const r = await fetch(`https://api.telegram.org/bot${value}/getMe`)
      if (!r.ok) return { ok: false, message: `Telegram antwortet ${r.status}` }
      const j = await r.json().catch(() => ({}))
      return { ok: true, message: j.result?.username ? `OK · @${j.result.username}` : 'OK' }
    }
    return { ok: true, message: 'Gespeichert (kein Live-Test möglich)' }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}
