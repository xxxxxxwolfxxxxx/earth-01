// Vollständiger Katalog kostenloser KI- & API-Anbieter.
// Jeder Eintrag enthält Default-URL und optional Affiliate-URL.
// Affiliate-URLs werden vom Plattform-Betreiber via /provider-Adminmodus eingetragen.

export const PROVIDER_CATEGORIES = [
  { id: 'llm',     label: 'Sprachmodelle',   icon: '🧠', desc: 'Chat-Modelle für Antworten, Übersetzung, Zusammenfassung' },
  { id: 'audio',   label: 'Audio',           icon: '🎙️', desc: 'Spracherkennung und Sprachsynthese' },
  { id: 'image',   label: 'Bilder & Video',  icon: '🎨', desc: 'Bild-Generation, Video, Embeddings' },
  { id: 'data',    label: 'Daten & Suche',   icon: '📊', desc: 'Wetter, Übersetzung, Web-Suche, News' },
  { id: 'mail',    label: 'Mail & Push',     icon: '📨', desc: 'Email-Versand und Push-Benachrichtigungen' },
  { id: 'storage', label: 'Storage & DB',    icon: '🗄️', desc: 'Datenbanken, Vector-Stores, Caches' },
  { id: 'hosting', label: 'Hosting',         icon: '☁️', desc: 'Frontend- und Backend-Deployments' },
]

// Jeder Anbieter:
// - id: stable key für Affiliate-Mapping
// - hasAffiliate: zeigt das "Ref"-Badge an wenn affiliate-URL gesetzt
// - free: kurze, ehrliche Free-Tier-Beschreibung
// - notes: optionale Hinweise (Vorteile, Limits, Setup-Aufwand)
export const PROVIDERS = [
  // ───── SPRACHMODELLE ─────
  {
    id: 'groq', category: 'llm', name: 'Groq', logo: '⚡',
    free: '14k Tokens/Min · Llama 3.3, Mixtral · keine Kreditkarte',
    notes: 'Schnellster Inference-Provider (eigene LPU-Chips). Empfohlener Einstieg.',
    defaultUrl: 'https://console.groq.com/keys',
    hasAffiliate: false,
  },
  {
    id: 'openrouter', category: 'llm', name: 'OpenRouter', logo: '🔀',
    free: 'Zugang zu allen Modellen über eine API · `:free` Tags sind dauerhaft gratis',
    notes: 'Universalwerkzeug: ein Key für 200+ Modelle. Free-Tier-Modelle ohne Kosten.',
    defaultUrl: 'https://openrouter.ai/keys',
    hasAffiliate: true,
  },
  {
    id: 'nvidia', category: 'llm', name: 'NVIDIA Build', logo: '🟢',
    free: '1000 Credits/Monat (~10 Mio. Tokens) · große Modelle (Kimi, DeepSeek)',
    defaultUrl: 'https://build.nvidia.com',
    hasAffiliate: false,
  },
  {
    id: 'anthropic', category: 'llm', name: 'Anthropic Claude', logo: '🅰️',
    free: '5 $ Test-Credits einmalig',
    notes: 'Beste Qualität für Code und Reasoning, aber Free-Tier knapp.',
    defaultUrl: 'https://console.anthropic.com',
    hasAffiliate: false,
  },
  {
    id: 'openai', category: 'llm', name: 'OpenAI', logo: '🟦',
    free: 'Trial-Credits (regional unterschiedlich)',
    notes: 'Industrie-Standard. Free-Tier eingeschränkt — eher als Backup gedacht.',
    defaultUrl: 'https://platform.openai.com/api-keys',
    hasAffiliate: false,
  },
  {
    id: 'google_ai', category: 'llm', name: 'Google AI Studio (Gemini)', logo: '🟡',
    free: '1500 Anfragen/Tag · Gemini Flash kostenlos',
    notes: 'Großzügig. Brauchst nur einen Google-Account.',
    defaultUrl: 'https://aistudio.google.com/app/apikey',
    hasAffiliate: false,
  },
  {
    id: 'mistral', category: 'llm', name: 'Mistral La Plateforme', logo: '🌊',
    free: 'Kostenlose Stufe für Codestral, Ministral, Mistral Nemo',
    defaultUrl: 'https://console.mistral.ai/api-keys',
    hasAffiliate: false,
  },
  {
    id: 'cerebras', category: 'llm', name: 'Cerebras Cloud', logo: '🧬',
    free: 'Llama 3 70B gratis · sehr schnell (~2000 Tokens/Sek)',
    defaultUrl: 'https://cloud.cerebras.ai',
    hasAffiliate: false,
  },
  {
    id: 'cloudflare_ai', category: 'llm', name: 'Cloudflare Workers AI', logo: '🟠',
    free: '10.000 Neurons/Tag · Llama, Mistral, Gemma',
    notes: 'Läuft am Edge — niedrige Latenz weltweit.',
    defaultUrl: 'https://dash.cloudflare.com',
    hasAffiliate: false,
  },
  {
    id: 'together', category: 'llm', name: 'Together AI', logo: '🤝',
    free: '$5 Trial-Credit · viele OpenSource-Modelle',
    defaultUrl: 'https://api.together.xyz/settings/api-keys',
    hasAffiliate: true,
  },

  // ───── AUDIO ─────
  {
    id: 'groq_whisper', category: 'audio', name: 'Groq Whisper', logo: '⚡🎤',
    free: '7200 Sek Audio/Tag · sehr schnell',
    notes: 'Gleicher Key wie Groq-LLM. Bestes Free-Whisper aktuell.',
    defaultUrl: 'https://console.groq.com/keys',
    hasAffiliate: false,
  },
  {
    id: 'elevenlabs', category: 'audio', name: 'ElevenLabs', logo: '🔊',
    free: '10.000 Zeichen/Monat · natürliche Stimmen',
    notes: 'Beste TTS-Qualität. Spracherkennung über Eleven Scribe ebenfalls.',
    defaultUrl: 'https://elevenlabs.io/app/settings/api-keys',
    hasAffiliate: true,
  },
  {
    id: 'deepgram', category: 'audio', name: 'Deepgram', logo: '🟣',
    free: '200 $ Free-Credits',
    notes: 'Sehr genaue Spracherkennung. 200 $ reichen für viele Stunden Audio.',
    defaultUrl: 'https://console.deepgram.com',
    hasAffiliate: false,
  },
  {
    id: 'assemblyai', category: 'audio', name: 'AssemblyAI', logo: '🔵',
    free: '50 $ Free-Credits',
    notes: 'Speziell für Transkription mit Speaker-Diarization.',
    defaultUrl: 'https://www.assemblyai.com/app',
    hasAffiliate: false,
  },
  {
    id: 'cartesia', category: 'audio', name: 'Cartesia', logo: '🎭',
    free: '10.000 Credits gratis',
    notes: 'Sehr schnelle TTS (50ms Latenz). Sonic-Modell.',
    defaultUrl: 'https://play.cartesia.ai',
    hasAffiliate: false,
  },

  // ───── BILDER & VIDEO ─────
  {
    id: 'huggingface', category: 'image', name: 'Hugging Face', logo: '🤗',
    free: 'Inferenz-API für tausende OpenSource-Modelle',
    notes: 'Embeddings, Klassifikation, Bild-Gen — alles unter einer Plattform.',
    defaultUrl: 'https://huggingface.co/settings/tokens',
    hasAffiliate: false,
  },
  {
    id: 'replicate', category: 'image', name: 'Replicate', logo: '🔁',
    free: 'Trial-Credits · Pay-as-you-go danach',
    notes: 'Stable Diffusion, Flux, Video-Modelle. Sehr breites Modell-Sortiment.',
    defaultUrl: 'https://replicate.com/account/api-tokens',
    hasAffiliate: true,
  },
  {
    id: 'fal_ai', category: 'image', name: 'FAL.ai', logo: '⚡🎨',
    free: '$5 Test-Credit · extrem schnelle Bild-Inferenz',
    defaultUrl: 'https://fal.ai/dashboard/keys',
    hasAffiliate: false,
  },
  {
    id: 'stability', category: 'image', name: 'Stability AI', logo: '✨',
    free: '25 Credits gratis · Stable Diffusion 3, SDXL',
    defaultUrl: 'https://platform.stability.ai/account/keys',
    hasAffiliate: false,
  },
  {
    id: 'pollinations', category: 'image', name: 'Pollinations.ai', logo: '🌻',
    free: 'Komplett kostenlos · kein Account nötig · einfache URL-API',
    notes: 'Perfekt für Demos und Schulungen — direkt Image-URL ohne Setup.',
    defaultUrl: 'https://pollinations.ai',
    hasAffiliate: false,
  },

  // ───── DATEN & SUCHE ─────
  {
    id: 'openweather', category: 'data', name: 'OpenWeather', logo: '🌤️',
    free: '1000 Anfragen/Tag',
    defaultUrl: 'https://openweathermap.org/api',
    hasAffiliate: false,
  },
  {
    id: 'deepl', category: 'data', name: 'DeepL', logo: '🌐',
    free: '500.000 Zeichen/Monat',
    notes: 'Beste Übersetzungsqualität für Deutsch.',
    defaultUrl: 'https://www.deepl.com/pro-api',
    hasAffiliate: false,
  },
  {
    id: 'brave_search', category: 'data', name: 'Brave Search', logo: '🦁',
    free: '2000 Anfragen/Monat',
    notes: 'Privacy-fokussiert, eigener Index — kein Google-Reseller.',
    defaultUrl: 'https://api.search.brave.com/app/keys',
    hasAffiliate: false,
  },
  {
    id: 'tavily', category: 'data', name: 'Tavily Search', logo: '🔎',
    free: '1000 Anfragen/Monat',
    notes: 'KI-orientierte Web-Suche — gibt direkt verarbeitbare Snippets zurück.',
    defaultUrl: 'https://tavily.com',
    hasAffiliate: false,
  },
  {
    id: 'newsapi', category: 'data', name: 'NewsAPI', logo: '📰',
    free: '100 Anfragen/Tag (Developer-Tier)',
    defaultUrl: 'https://newsapi.org/register',
    hasAffiliate: false,
  },
  {
    id: 'serpapi', category: 'data', name: 'SerpAPI', logo: '🔍',
    free: '100 Suchen/Monat',
    notes: 'Strukturierte Google-/Bing-Ergebnisse.',
    defaultUrl: 'https://serpapi.com/manage-api-key',
    hasAffiliate: false,
  },

  // ───── MAIL & PUSH ─────
  {
    id: 'resend', category: 'mail', name: 'Resend', logo: '✉️',
    free: '3000 Mails/Monat',
    notes: 'Saubere Developer-Experience, gute Zustellraten.',
    defaultUrl: 'https://resend.com/api-keys',
    hasAffiliate: true,
  },
  {
    id: 'brevo', category: 'mail', name: 'Brevo (Sendinblue)', logo: '🟩',
    free: '300 Mails/Tag · auch SMS-Tier',
    defaultUrl: 'https://app.brevo.com',
    hasAffiliate: true,
  },
  {
    id: 'sendgrid', category: 'mail', name: 'SendGrid', logo: '🟦',
    free: '100 Mails/Tag dauerhaft',
    defaultUrl: 'https://signup.sendgrid.com',
    hasAffiliate: false,
  },
  {
    id: 'pushover', category: 'mail', name: 'Pushover', logo: '🔔',
    free: 'Einmal 5 $ App-Lizenz, danach unbegrenzt',
    notes: 'Push-Notifications ohne Telegram. Perfekt für stille Erinnerungen.',
    defaultUrl: 'https://pushover.net',
    hasAffiliate: false,
  },

  // ───── STORAGE & DB ─────
  {
    id: 'supabase', category: 'storage', name: 'Supabase', logo: '🟢',
    free: '500 MB DB · 500k Edge-Function-Calls/Monat',
    notes: 'Postgres + Auth + Realtime + Storage — die Plattform die Earth 0.1 trägt.',
    defaultUrl: 'https://supabase.com',
    hasAffiliate: true,
  },
  {
    id: 'upstash', category: 'storage', name: 'Upstash', logo: '🟤',
    free: '10.000 Commands/Tag · Redis + Vector + Kafka',
    notes: 'Serverless. Perfekt für Caches und Vector-Stores.',
    defaultUrl: 'https://console.upstash.com',
    hasAffiliate: false,
  },
  {
    id: 'neon', category: 'storage', name: 'Neon', logo: '🟣',
    free: '0.5 GB Postgres · Branching wie Git',
    defaultUrl: 'https://console.neon.tech',
    hasAffiliate: false,
  },
  {
    id: 'turso', category: 'storage', name: 'Turso', logo: '🐢',
    free: '500 DBs · 9 GB Storage · 1 Mrd. Zeilen-Reads',
    notes: 'SQLite am Edge. Sehr großzügiger Free-Tier.',
    defaultUrl: 'https://app.turso.tech',
    hasAffiliate: false,
  },
  {
    id: 'pinecone', category: 'storage', name: 'Pinecone', logo: '🌲',
    free: '100k Vektoren gratis · Serverless-Index',
    notes: 'Vector-Datenbank für RAG-Anwendungen.',
    defaultUrl: 'https://app.pinecone.io',
    hasAffiliate: false,
  },

  // ───── HOSTING ─────
  {
    id: 'netlify', category: 'hosting', name: 'Netlify', logo: '🟦',
    free: '100 GB Traffic/Monat · 300 Build-Min/Monat',
    notes: 'Earth 0.1 läuft selbst auf Netlify.',
    defaultUrl: 'https://app.netlify.com/signup',
    hasAffiliate: true,
  },
  {
    id: 'vercel', category: 'hosting', name: 'Vercel', logo: '▲',
    free: '100 GB Traffic · Edge-Functions gratis',
    defaultUrl: 'https://vercel.com/signup',
    hasAffiliate: true,
  },
  {
    id: 'railway', category: 'hosting', name: 'Railway', logo: '🚂',
    free: '$5 Trial-Credit · einfacher Docker-Deploy',
    defaultUrl: 'https://railway.app',
    hasAffiliate: true,
  },
  {
    id: 'render', category: 'hosting', name: 'Render', logo: '🎯',
    free: 'Statisches Hosting + 750h Web-Service/Monat',
    defaultUrl: 'https://render.com',
    hasAffiliate: false,
  },
  {
    id: 'cloudflare_pages', category: 'hosting', name: 'Cloudflare Pages', logo: '🟠',
    free: 'Unbegrenzter Traffic · 500 Builds/Monat',
    defaultUrl: 'https://pages.cloudflare.com',
    hasAffiliate: false,
  },
]
