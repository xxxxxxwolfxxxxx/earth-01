const LLM_SETTINGS_KEY = 'earth01_llm_settings'

export function loadLLMSettings() {
  try {
    return JSON.parse(localStorage.getItem(LLM_SETTINGS_KEY)) || null
  } catch {
    return null
  }
}

export function saveLLMSettings(settings) {
  localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(settings))
}

export function clearLLMSettings() {
  localStorage.removeItem(LLM_SETTINGS_KEY)
}

export async function queryLLM(prompt, settings) {
  if (!settings?.provider || !settings?.baseUrl) {
    throw new Error('Kein LLM konfiguriert')
  }

  const { provider, baseUrl, apiKey, model } = settings

  if (provider === 'gemini') {
    return queryGemini(prompt, baseUrl, apiKey, model)
  }

  return queryOpenAICompatible(prompt, baseUrl, apiKey, model)
}

async function queryOpenAICompatible(prompt, baseUrl, apiKey, model) {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || undefined,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LLM-Fehler ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function queryGemini(prompt, baseUrl, apiKey, model) {
  const modelName = model || 'gemini-2.0-flash'
  const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini-Fehler ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

export async function testConnection(settings) {
  try {
    const result = await queryLLM('Antworte mit genau einem Wort: "OK"', settings)
    return { ok: true, response: result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export const PROVIDER_PRESETS = {
  lmstudio: {
    label: 'LM Studio (lokal)',
    baseUrl: 'http://localhost:1234',
    needsKey: false,
    needsModel: false,
  },
  ollama: {
    label: 'Ollama (lokal)',
    baseUrl: 'http://localhost:11434',
    needsKey: false,
    needsModel: true,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    needsKey: true,
    needsModel: true,
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    needsKey: true,
    needsModel: false,
  },
  custom: {
    label: 'Eigener Endpoint',
    baseUrl: '',
    needsKey: false,
    needsModel: true,
  },
}
