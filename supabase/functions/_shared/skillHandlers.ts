// Skill-Handler für die 11 action-typ Skills (Telegram-Pattern → Antwort).
// Browser-typ Skills (qr_code, dice, math_practice, hash_tools, password_gen, leak_check)
// werden ausschließlich im Frontend gehandhabt.

import { BOT } from "./botMessages.ts";
import { findRelevant, QueryHit } from "./ragQuery.ts";
import { CloudConfig } from "./cloudAdapters.ts";
import { generateImage } from "./imageGen.ts";
import { synthesize } from "./tts.ts";
import { sendMail } from "./mail.ts";

export interface SkillContext {
  supabase: any;
  user_id: string;
  message: string;
}

export interface SkillResult {
  reply: string;
  image?: Blob;
  imageCaption?: string;
  voice?: Blob;
  voiceCaption?: string;
}

// ─── Pattern B: Web-APIs ──────────────────────────────────

export async function skillWeather(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/wetter|wetter in)\s+(.+)|wie ist das wetter\s+in\s+(.+)/i);
  const city = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!city) return { reply: BOT.weather_no_city() };
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`);
    const gj = await geo.json();
    const place = gj.results?.[0];
    if (!place) return { reply: `Dein Bot konnte '${city}' nicht finden.` };
    // Standort im Profil hinterlegen — fließt in Live-Earth ein.
    await ctx.supabase.from("profiles").update({
      home_lat: place.latitude,
      home_lon: place.longitude,
      home_city: place.name,
    }).eq("id", ctx.user_id);
    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
    const wxj = await wx.json();
    const c = wxj.current ?? {};
    return { reply: `🌤️ ${place.name}: ${c.temperature_2m}°C, Wind ${c.wind_speed_10m} km/h.` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillWebSearch(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/such(?:e)?|finde)\s+(.+)|was bedeutet\s+(.+)/i);
  const q = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!q) return { reply: BOT.search_no_query() };
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`);
    const d = await r.json();
    const abs = d.AbstractText || d.Heading || (d.RelatedTopics?.[0]?.Text ?? "");
    return { reply: abs ? `🔍 ${abs}` : `Dein Bot fand nichts zu '${q}'.` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillWikipedia(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/wiki|wikipedia|was ist)\s+(.+)/i);
  const q = (match?.[1] ?? "").trim();
  if (!q) return { reply: `Worum geht's? Probier 'was ist Photosynthese'.` };
  try {
    const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
    if (!r.ok) return { reply: `Dein Bot fand kein Wikipedia-Eintrag zu '${q}'.` };
    const d = await r.json();
    return { reply: `📖 ${d.title}\n\n${d.extract}` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillCurrency(ctx: SkillContext): Promise<SkillResult> {
  const m1 = ctx.message.match(/(?:wie viel\s+sind\s+)?(\d+(?:[.,]\d+)?)\s+([a-zA-Z]{3})\s+in\s+([a-zA-Z]{3})/i);
  const m2 = ctx.message.match(/\/kurs\s+([a-zA-Z]{3})\s+([a-zA-Z]{3})(?:\s+(\d+(?:[.,]\d+)?))?/i);
  const amount = m1 ? parseFloat(m1[1].replace(",", ".")) : (m2 ? parseFloat(m2[3] ?? "1") : 1);
  const from = (m1?.[2] ?? m2?.[1] ?? "").toUpperCase();
  const to = (m1?.[3] ?? m2?.[2] ?? "").toUpperCase();
  if (!from || !to) return { reply: `Probier 'wie viel sind 50 USD in EUR' oder '/kurs USD EUR'.` };
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);
    const d = await r.json();
    const result = d.rates?.[to];
    if (result == null) return { reply: `Dein Bot kennt die Währung nicht: '${from}' oder '${to}'.` };
    return { reply: `💱 ${amount} ${from} = ${result.toFixed(2)} ${to}` };
  } catch {
    return { reply: BOT.error() };
  }
}

export async function skillCountries(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/land|info zu|hauptstadt von)\s+(.+)/i);
  const name = (m?.[1] ?? "").trim();
  if (!name) return { reply: `Welches Land? Probier '/land Frankreich'.` };
  try {
    const r = await fetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(name)}`);
    if (!r.ok) {
      const r2 = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      if (!r2.ok) return { reply: `Dein Bot kennt '${name}' nicht.` };
      const d = await r2.json();
      const c = d[0];
      return { reply: `🌍 ${c.translations?.deu?.common ?? c.name.common}\nHauptstadt: ${c.capital?.[0] ?? "—"}\nEinwohner: ${c.population.toLocaleString("de")}\nSprachen: ${Object.values(c.languages ?? {}).join(", ")}` };
    }
    const d = await r.json();
    const c = d[0];
    return { reply: `🌍 ${c.translations?.deu?.common ?? c.name.common}\nHauptstadt: ${c.capital?.[0] ?? "—"}\nEinwohner: ${c.population.toLocaleString("de")}\nSprachen: ${Object.values(c.languages ?? {}).join(", ")}` };
  } catch {
    return { reply: BOT.error() };
  }
}

const FAMOUS_QUOTES = [
  ["Der Weg ist das Ziel.", "Konfuzius"],
  ["Phantasie ist wichtiger als Wissen, denn Wissen ist begrenzt.", "Albert Einstein"],
  ["Es ist nicht wenig Zeit, die wir haben, sondern es ist viel Zeit, die wir nicht nutzen.", "Seneca"],
  ["Wer immer tut, was er schon kann, bleibt immer das, was er schon ist.", "Henry Ford"],
  ["Man sieht nur mit dem Herzen gut. Das Wesentliche ist für die Augen unsichtbar.", "Antoine de Saint-Exupéry"],
  ["Sei du selbst die Veränderung, die du dir wünschst für diese Welt.", "Mahatma Gandhi"],
  ["Erfolg ist nicht endgültig, Misserfolg ist nicht fatal. Es ist der Mut weiterzumachen, der zählt.", "Winston Churchill"],
  ["Wer kämpft, kann verlieren. Wer nicht kämpft, hat schon verloren.", "Bertolt Brecht"],
  ["Auch aus Steinen, die einem in den Weg gelegt werden, kann man Schönes bauen.", "Johann Wolfgang von Goethe"],
  ["Das Geheimnis des Vorwärtskommens besteht darin, den ersten Schritt zu tun.", "Mark Twain"],
  ["In der Mitte von Schwierigkeiten liegen die Möglichkeiten.", "Albert Einstein"],
  ["Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.", "Seneca"],
  ["Wer ein Warum zum Leben hat, erträgt fast jedes Wie.", "Friedrich Nietzsche"],
  ["Glück ist das einzige, das sich verdoppelt, wenn man es teilt.", "Albert Schweitzer"],
  ["Die Neugier steht immer an erster Stelle eines Problems, das gelöst werden will.", "Galileo Galilei"],
  ["Es ist nie zu spät, das zu werden, was man hätte sein können.", "George Eliot"],
  ["Wissen ist Macht.", "Francis Bacon"],
  ["Der frühe Vogel fängt den Wurm, aber die zweite Maus bekommt den Käse.", "Sprichwort"],
];

export async function skillJokeQuote(ctx: SkillContext): Promise<SkillResult> {
  // /zitat → berühmtes Zitat. /witz (oder alles andere) → Witz.
  if (/zitat/i.test(ctx.message)) {
    const [q, author] = FAMOUS_QUOTES[Math.floor(Math.random() * FAMOUS_QUOTES.length)];
    return { reply: `💬 „${q}"\n— ${author}` };
  }
  try {
    const r = await fetch("https://v2.jokeapi.dev/joke/Any?lang=de&safe-mode");
    const d = await r.json();
    if (d.type === "single") return { reply: `😄 ${d.joke}` };
    if (d.type === "twopart") return { reply: `😄 ${d.setup}\n\n... ${d.delivery}` };
    return { reply: `😄 Witz konnte nicht geladen werden, aber dein Bot bleibt fröhlich!` };
  } catch {
    return { reply: `😄 Warum nehmen Programmierer immer Pullover mit ins Büro? Wegen der Cookies!` };
  }
}

// ─── Tracking: DB-CRUD über user_data ─────────────────────

export async function skillNotes(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/notiz|notiz:|liste:)\s*(.+)/i);
  const content = (m?.[1] ?? "").trim();
  if (!content) {
    const { data } = await ctx.supabase
      .from("user_data")
      .select("value, created_at")
      .eq("user_id", ctx.user_id)
      .eq("namespace", "notes")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!data || data.length === 0) return { reply: `Dein Bot hat noch keine Notizen. Probier 'notiz: Milch kaufen'.` };
    return { reply: `📝 Deine letzten Notizen:\n${data.map((r: any) => `• ${r.value.text}`).join("\n")}` };
  }
  await ctx.supabase.from("user_data").insert({
    user_id: ctx.user_id,
    namespace: "notes",
    key: `${Date.now()}`,
    value: { text: content },
  });
  return { reply: `📝 Notiert: '${content}'.` };
}

export async function skillMood(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/stimmung|stimmung:|mood:)\s*(\d)/i);
  const value = m ? parseInt(m[1]) : null;
  if (!value || value < 1 || value > 5) {
    return { reply: `Sag deinem Bot eine Zahl von 1 bis 5:\n1 😢 sehr schlecht · 2 😟 schlecht · 3 😐 geht so · 4 🙂 gut · 5 😄 super\n\nZ.B. „stimmung: 4".` };
  }
  await ctx.supabase.from("user_data").upsert({
    user_id: ctx.user_id,
    namespace: "mood",
    key: new Date().toISOString().slice(0, 10),
    value: { score: value },
  }, { onConflict: "user_id,namespace,key" });
  const faces = { 1: '😢 sehr schlecht', 2: '😟 schlecht', 3: '😐 geht so', 4: '🙂 gut', 5: '😄 super' };
  return { reply: `${faces[value as 1|2|3|4|5]} — Stimmung ${value}/5 für heute notiert.` };
}

export async function skillHabits(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/habit|habit:)\s*(.+)|heute\s+(.+)\s+gemacht/i);
  const habit = (m?.[1] ?? m?.[2] ?? "").trim();
  if (!habit) return { reply: `Welche Gewohnheit? Probier 'habit: meditiert'.` };
  const today = new Date().toISOString().slice(0, 10);
  await ctx.supabase.from("user_data").upsert({
    user_id: ctx.user_id,
    namespace: "habits",
    key: `${habit}:${today}`,
    value: { habit, date: today },
  }, { onConflict: "user_id,namespace,key" });
  return { reply: `💪 '${habit}' für heute eingetragen.` };
}

// ─── Automation: Reminder / Pomodoro ─────────────────────

export async function skillReminder(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:in\s+)?(\d+)\s+(min|minuten|stunde|stunden|h)\s+(?:erinnere mich an\s+|.*?:\s+)?(.+)/i);
  if (!m) return { reply: `Probier 'in 30 min erinnere mich an Yoga'.` };
  const num = parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const text = m[3].trim();
  const minutes = unit.startsWith("stunde") || unit === "h" ? num * 60 : num;
  const remind_at = new Date(Date.now() + minutes * 60_000).toISOString();
  await ctx.supabase.from("reminders").insert({
    user_id: ctx.user_id,
    content: text,
    remind_at,
    source_skill: "reminder",
  });
  return { reply: BOT.reminder_set(minutes) };
}

export async function skillPomodoro(ctx: SkillContext): Promise<SkillResult> {
  const focus = new Date(Date.now() + 25 * 60_000).toISOString();
  const breakTime = new Date(Date.now() + 30 * 60_000).toISOString();
  await ctx.supabase.from("reminders").insert([
    { user_id: ctx.user_id, content: "Fokus-Block vorbei. 5 Min Pause!", remind_at: focus, source_skill: "pomodoro" },
    { user_id: ctx.user_id, content: "Pause vorbei. Zurück an die Arbeit oder neuen Pomodoro?", remind_at: breakTime, source_skill: "pomodoro" },
  ]);
  return { reply: `🍅 Pomodoro läuft! 25 Min konzentriert arbeiten — dann meld ich mich zur Pause, 5 Min später zum Weitermachen. Danach ist die Runde vorbei (nichts auszuschalten). Für die nächste Runde schick einfach wieder /pomodoro.` };
}

// ─── Dispatch ────────────────────────────────────────────

export async function executeSkill(skill_id: string, ctx: SkillContext): Promise<SkillResult> {
  switch (skill_id) {
    case "weather": return skillWeather(ctx);
    case "web_search": return skillWebSearch(ctx);
    case "wikipedia": return skillWikipedia(ctx);
    case "currency": return skillCurrency(ctx);
    case "countries": return skillCountries(ctx);
    case "joke_quote": return skillJokeQuote(ctx);
    case "notes": return skillNotes(ctx);
    case "mood": return skillMood(ctx);
    case "habits": return skillHabits(ctx);
    case "reminder": return skillReminder(ctx);
    case "pomodoro": return skillPomodoro(ctx);
    case "ask_memory": return skillAskMemory(ctx);
    case "quota_check": return skillQuotaCheck(ctx);
    case "image_gen": return skillImageGen(ctx);
    case "voice_out": return skillVoiceOut(ctx);
    case "mail_send": return skillMailSend(ctx);
    case "chat": return skillChat(ctx);
    case "teamwork": return skillTeamwork(ctx);
    case "rss": return skillRss(ctx);
    case "dice": return skillDice(ctx);
    case "qr_code": return skillQr(ctx);
    case "hash_tools": return skillHash(ctx);
    case "password_gen": return skillPassword(ctx);
    default: return { reply: BOT.unknown_command() };
  }
}

// ─── RAG: Erinnerung abrufen ──────────────────────────────

// Hilfsfunktion: aktuelle Cloud-Config (Drive braucht frischen Access-Token).
export async function buildCloudConfig(supabase: any, userId: string, profile: any): Promise<CloudConfig> {
  if (profile.cloud_provider === "gdrive") {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    if (!clientId || !clientSecret) throw new Error("Google OAuth Secrets fehlen");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: profile.gdrive_refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Drive-Refresh: ${j.error_description || j.error}`);
    return {
      provider: "gdrive",
      gdriveAccessToken: j.access_token,
      gdriveFolderId: profile.gdrive_folder_id,
    };
  }
  if (profile.cloud_provider === "gist") {
    return {
      provider: "gist",
      githubPat: profile.github_pat,
      githubGistId: profile.github_gist_id,
    };
  }
  throw new Error("Keine Cloud konfiguriert");
}

export function buildSystemPrompt(profile: any): string {
  const lines: string[] = [];
  if (profile.bot_name)  lines.push(`Du heißt ${profile.bot_name}.`);
  if (profile.bot_role)  lines.push(`Du bist ${profile.bot_role}.`);
  if (profile.bot_tone)  lines.push(`Antworte ${profile.bot_tone}.`);
  if (profile.bot_extra) lines.push(profile.bot_extra);
  lines.push(
    "Beantworte die Frage anhand der mitgelieferten Notizen des Users — präzise, auf Deutsch, nur basierend auf den Notizen. Wenn nichts Passendes dabei ist, sag das ehrlich."
  );
  return lines.join(" ");
}

export async function llmAnswer(profile: any, query: string, context: string): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile);
  const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.llm_api_key}`,
    },
    body: JSON.stringify({
      model: profile.llm_model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Frage: ${query}\n\nMitgelieferte Notizen:\n${context}` },
      ],
      temperature: 0.3,
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? "(keine LLM-Antwort)";
}

export async function skillAskMemory(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/frag|frag)\s+(.+)/i);
  const query = m?.[1]?.trim();
  if (!query) {
    return { reply: "Schreib eine Frage hinterher: /frag wann hab ich Anna getroffen" };
  }

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("huggingface_key, cloud_provider, gdrive_refresh_token, gdrive_folder_id, github_gist_id, github_pat, llm_api_key, llm_base_url, llm_model, bot_name, bot_role, bot_tone, bot_extra")
    .eq("id", ctx.user_id)
    .single();
  if (!profile?.huggingface_key) {
    return { reply: "Erst Hugging-Face-Key auf /keys hinterlegen, dann klappt /frag." };
  }
  if (!profile?.cloud_provider) {
    return { reply: "Erst eine Cloud verbinden (auf /data), dann hat /frag was zu durchsuchen." };
  }

  try {
    const cloudConfig = await buildCloudConfig(ctx.supabase, ctx.user_id, profile);
    const hits = await findRelevant({
      supabase: ctx.supabase,
      userId: ctx.user_id,
      query,
      hfKey: profile.huggingface_key,
      cloudConfig,
      topK: 5,
    });
    if (hits.length === 0) {
      return { reply: "Nichts in deinen Notizen dazu gefunden." };
    }
    const context = hits.map((h, i) => `(${i + 1}) ${h.text}`).join("\n\n");
    const reply = await llmAnswer(profile, query, context);
    return { reply: reply + `\n\n📚 Aus ${hits.length} Notiz(en).` };
  } catch (e) {
    return { reply: `🧠 Fehler beim Erinnern: ${e.message}` };
  }
}

// ─── Quota-Check: Free-Tier-Limits aller Provider ─────────────

function formatBar(used: number | undefined, limit: number | undefined): string {
  if (used === undefined || limit === undefined || limit === 0) return "";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const filled = Math.round(pct / 10);
  return ` [${"█".repeat(filled)}${"░".repeat(10 - filled)}] ${pct}%`;
}

export async function skillQuotaCheck(ctx: SkillContext): Promise<SkillResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Service-Role-Token kann hier nicht den userId-Header senden, daher selbst aufrufen:
  // wir rufen die Function direkt mit Service-Role-Authentication an UND geben user_id mit?
  // Stattdessen einfacher: direkt aus dem Profil lesen und Probes hier inline machen.
  // Aber die Function existiert schon — wir geben User-Token weiter. Skill-Context hat den nicht.
  // Pragmatisch: hier inline die Probes nachbauen wäre Duplication.
  // Stattdessen: Service-Role-Call mit user_id Body — aber das ändert die Function.
  // Einfachster Weg: HTTP-Call mit Supabase-Anon-Key + Auth-Header das User-JWT mitgibt.
  // Im Telegram-Webhook-Context haben wir das nicht. Also: Function umstellen auf
  // service_role-Aufruf mit user_id im Body. Hier Workaround: direkter DB-Read + inline Probes.
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("llm_api_key, huggingface_key, elevenlabs_key, deepl_key, replicate_key, stability_key, resend_api_key, openweather_key")
    .eq("id", ctx.user_id).single();
  if (!profile) return { reply: "Profil nicht gefunden." };

  const lines: string[] = ["📊 <b>Deine Free-Tier-Limits</b>", ""];
  const probes: Promise<string>[] = [];

  if (profile.llm_api_key) {
    probes.push((async () => {
      const k = profile.llm_api_key;
      const prefix = k.startsWith("gsk_") ? "Groq"
        : k.startsWith("sk-or-") ? "OpenRouter"
        : k.startsWith("nvapi-") ? "NVIDIA"
        : k.startsWith("sk-ant-") ? "Anthropic"
        : k.startsWith("sk-") ? "OpenAI"
        : "LLM";
      const base = k.startsWith("gsk_") ? "https://api.groq.com/openai/v1"
        : k.startsWith("sk-or-") ? "https://openrouter.ai/api/v1"
        : k.startsWith("nvapi-") ? "https://integrate.api.nvidia.com/v1"
        : k.startsWith("sk-") ? "https://api.openai.com/v1"
        : null;
      if (!base) return `🧠 ${prefix}: kein Live-Probe möglich`;
      try {
        const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${k}` }});
        if (!r.ok) return `🧠 ${prefix}: HTTP ${r.status}`;
        const remT = r.headers.get("x-ratelimit-remaining-tokens");
        const limT = r.headers.get("x-ratelimit-limit-tokens");
        if (remT && limT) {
          return `🧠 ${prefix}: ${remT}/${limT} Tokens/min${formatBar(Number(limT)-Number(remT), Number(limT))}`;
        }
        return `🧠 ${prefix}: aktiv`;
      } catch { return `🧠 ${prefix}: Fehler`; }
    })());
  }

  if (profile.elevenlabs_key) {
    probes.push((async () => {
      try {
        const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": profile.elevenlabs_key }});
        if (!r.ok) return `🔊 ElevenLabs: HTTP ${r.status}`;
        const j: any = await r.json();
        const used = j?.subscription?.character_count ?? 0;
        const limit = j?.subscription?.character_limit ?? 0;
        return `🔊 ElevenLabs: ${used}/${limit} Zeichen/Monat${formatBar(used, limit)}`;
      } catch { return `🔊 ElevenLabs: Fehler`; }
    })());
  }

  if (profile.deepl_key) {
    probes.push((async () => {
      const base = profile.deepl_key.endsWith(":fx") ? "https://api-free.deepl.com/v2" : "https://api.deepl.com/v2";
      try {
        const r = await fetch(`${base}/usage`, { headers: { Authorization: `DeepL-Auth-Key ${profile.deepl_key}` }});
        if (!r.ok) return `🌐 DeepL: HTTP ${r.status}`;
        const j: any = await r.json();
        return `🌐 DeepL: ${j.character_count}/${j.character_limit} Zeichen/Monat${formatBar(j.character_count, j.character_limit)}`;
      } catch { return `🌐 DeepL: Fehler`; }
    })());
  }

  if (profile.stability_key) {
    probes.push((async () => {
      try {
        const r = await fetch("https://api.stability.ai/v1/user/balance", { headers: { Authorization: `Bearer ${profile.stability_key}` }});
        if (!r.ok) return `✨ Stability: HTTP ${r.status}`;
        const j: any = await r.json();
        return `✨ Stability: ${Math.round(j.credits)} Credits übrig`;
      } catch { return `✨ Stability: Fehler`; }
    })());
  }

  if (profile.huggingface_key) {
    probes.push((async () => {
      try {
        const r = await fetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${profile.huggingface_key}` }});
        if (!r.ok) return `🤗 Hugging Face: HTTP ${r.status}`;
        const j: any = await r.json();
        return `🤗 Hugging Face: ${j.name ?? "User"} · ${j.plan ?? "Free"}`;
      } catch { return `🤗 Hugging Face: Fehler`; }
    })());
  }

  if (profile.openweather_key) {
    probes.push((async () => {
      try {
        const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Berlin&appid=${encodeURIComponent(profile.openweather_key)}`);
        return r.ok ? `🌤️ OpenWeather: aktiv (1000/Tag)` : `🌤️ OpenWeather: HTTP ${r.status}`;
      } catch { return `🌤️ OpenWeather: Fehler`; }
    })());
  }

  if (probes.length === 0) {
    return { reply: "Keine Provider-Keys hinterlegt. Schau auf /keys vorbei." };
  }

  const results = await Promise.all(probes);
  return { reply: lines.concat(results).join("\n") };
}

// ─── Bild-Generation: HF FLUX/SDXL als Default, Replicate als Premium ─────

export async function skillImageGen(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/bild|\/image|mal mir|bild von|bild:)\s+(.+)/i);
  const prompt = (m?.[1] ?? "").trim();
  if (!prompt) {
    return { reply: "Was soll ich malen? Probier: /bild ein Astronaut auf einem Skateboard im All" };
  }

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("huggingface_key, replicate_key")
    .eq("id", ctx.user_id).single();
  if (!profile?.huggingface_key && !profile?.replicate_key) {
    return { reply: "Erst Hugging-Face- oder Replicate-Key auf /keys hinterlegen." };
  }

  const result = await generateImage({
    prompt,
    hfKey: profile.huggingface_key,
    replicateKey: profile.replicate_key,
  });

  if (!result.ok || !result.blob) {
    return { reply: `🎨 Bild-Erzeugung fehlgeschlagen: ${result.error ?? "Unbekannt"}` };
  }
  return {
    reply: "",
    image: result.blob,
    imageCaption: `🎨 „${prompt}"  ·  ${result.provider}/${result.model}`,
  };
}

// ─── Voice-Out: ElevenLabs TTS für /sage und Mirror-Modus ──────

export async function skillVoiceOut(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/sage|\/voice|sag(?:'s)?|sprich)\s+(.+)/i);
  const text = (m?.[1] ?? "").trim();
  if (!text) {
    return { reply: "Was soll dein Bot sagen? Probier: /sage Hallo, wie geht's?" };
  }

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("elevenlabs_key")
    .eq("id", ctx.user_id).single();
  if (!profile?.elevenlabs_key) {
    return { reply: "Erst ElevenLabs-Key auf /keys hinterlegen — gibt 10.000 Zeichen gratis/Monat." };
  }

  const result = await synthesize(text, profile.elevenlabs_key);
  if (!result.ok || !result.blob) {
    return { reply: `🔊 TTS fehlgeschlagen: ${result.error ?? "Unbekannt"}` };
  }
  return { reply: "", voice: result.blob, voiceCaption: `🔊 „${text}"` };
}

// ─── Mail-Send: Resend ─────────────────────────────────────

export async function skillMailSend(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/mail|mail an)\s+(.+)/i);
  const raw = (m?.[1] ?? "").trim();
  if (!raw) {
    return { reply: "So geht's: /mail empfänger@x.de | Betreff | Inhalt" };
  }
  const parts = raw.split("|").map(s => s.trim());
  if (parts.length < 3) {
    return { reply: "Bitte Pipe-getrennt: /mail empfänger@x.de | Betreff | Inhalt" };
  }
  const [to, subject, ...bodyParts] = parts;
  const body = bodyParts.join(" | ");

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("resend_api_key")
    .eq("id", ctx.user_id).single();
  if (!profile?.resend_api_key) {
    return { reply: "Erst Resend-Key auf /keys hinterlegen (3000 Mails/Monat gratis bei resend.com)." };
  }

  const result = await sendMail({
    to, subject, body,
    resendKey: profile.resend_api_key,
  });
  if (!result.ok) {
    let hint = "";
    if (result.error?.toLowerCase().includes("domain")) {
      hint = "\n\n💡 Resend braucht für fremde Empfänger eine verifizierte Domain (resend.com/domains). Ohne Domain kannst du nur an deine eigene Resend-Account-Mail senden.";
    }
    return { reply: `📧 Mail fehlgeschlagen: ${result.error}${hint}` };
  }
  return { reply: `📧 Mail an ${to} versendet. ID: ${result.messageId?.slice(0, 8) ?? "—"}` };
}

// ─── Chat: freier LLM-Chat mit Persona ──────────────────────

export async function skillChat(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:^|\s)\/chat\s+(.+)/i);
  const q = (m?.[1] ?? "").trim();
  if (!q) {
    return { reply: "Schreib eine Frage hinterher: /chat Erklär mir Embeddings" };
  }
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("llm_api_key, llm_base_url, llm_model, bot_name, bot_role, bot_tone, bot_extra")
    .eq("id", ctx.user_id).single();
  if (!profile?.llm_api_key || !profile?.llm_base_url || !profile?.llm_model) {
    return { reply: "Erst Sprachmodell-Key auf /keys hinterlegen." };
  }

  // Persona-Prompt nutzen, ohne RAG-Kontext-Klausel
  const personaLines: string[] = [];
  if (profile.bot_name)  personaLines.push(`Du heißt ${profile.bot_name}.`);
  if (profile.bot_role)  personaLines.push(`Du bist ${profile.bot_role}.`);
  if (profile.bot_tone)  personaLines.push(`Antworte ${profile.bot_tone}.`);
  if (profile.bot_extra) personaLines.push(profile.bot_extra);
  if (personaLines.length === 0) personaLines.push("Du bist ein hilfreicher Assistent. Antworte präzise und auf Deutsch.");

  try {
    const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.llm_api_key}` },
      body: JSON.stringify({
        model: profile.llm_model,
        messages: [
          { role: "system", content: personaLines.join(" ") },
          { role: "user", content: q },
        ],
        temperature: 0.7,
      }),
    });
    const j = await r.json();
    if (!r.ok) return { reply: `🤖 LLM-Fehler: ${j?.error?.message ?? r.status}` };
    const reply = j?.choices?.[0]?.message?.content ?? "(keine Antwort)";
    return { reply };
  } catch (e) {
    return { reply: `🤖 Verbindungsfehler: ${(e as Error).message}` };
  }
}

// ─── Teamwork: Bot-Status + Credits ────────────────────────

export async function skillTeamwork(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/\/(arbeiten|heim|credits)/i);
  const cmd = (m?.[1] ?? '').toLowerCase();
  if (!cmd) return { reply: "Probier: /arbeiten · /heim · /credits" };

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("bot_at_work, bot_work_started_at, job_credits, jobs_done_total")
    .eq("id", ctx.user_id).single();
  if (!profile) return { reply: "Profil nicht gefunden" };

  if (cmd === 'credits') {
    return {
      reply: `💰 Dein Konto:\n${Number(profile.job_credits).toFixed(1)} Credits\n${profile.jobs_done_total} Jobs gesamt erledigt.\n\nMit 50 Credits startest du eine Mammutaufgabe (z.B. „/projekt website Mein Portfolio").`
    };
  }
  if (cmd === 'arbeiten') {
    if (profile.bot_at_work) {
      const started = profile.bot_work_started_at ? new Date(profile.bot_work_started_at) : null;
      const ago = started ? Math.floor((Date.now() - started.getTime()) / 60_000) : 0;
      return { reply: `🤝 Dein Bot arbeitet schon (seit ${ago} Min). Mit „/heim" holst du ihn zurück.` };
    }
    await ctx.supabase.from("profiles").update({
      bot_at_work: true, bot_work_started_at: new Date().toISOString(),
    }).eq("id", ctx.user_id);
    return { reply: `🤝 Dein Bot ist los! Er pickt sich Jobs aus dem Schwarm. Pro Job kriegst du 0.9 Credits, 0.1 fließt in den Gemeinschafts-Pool. Mit „/heim" holst du ihn zurück.` };
  }
  if (cmd === 'heim') {
    if (!profile.bot_at_work) {
      return { reply: `🏠 Dein Bot ist schon zu Hause. Aktueller Stand: ${Number(profile.job_credits).toFixed(1)} Credits.` };
    }
    await ctx.supabase.from("profiles").update({
      bot_at_work: false,
    }).eq("id", ctx.user_id);
    return { reply: `🏠 Dein Bot ist wieder zu Hause. Aktueller Stand: ${Number(profile.job_credits).toFixed(1)} Credits.` };
  }
  return { reply: "Probier: /arbeiten · /heim · /credits" };
}

// ─── RSS-Reader ───────────────────────────────────────────
// /rss <url>  — Feed abonnieren
// /feeds      — Abos auflisten
// /unfeed <n> — Abo Nummer n entfernen

// Minimaler RSS/Atom-Parser. Liefert {title, entries:[{title,link,key}]}.
export function parseFeed(xml: string): { title: string; entries: { title: string; link: string; key: string }[] } {
  const pick = (s: string, tag: string): string => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    let v = m?.[1] ?? '';
    v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    return v;
  };
  const pickAttr = (s: string, tag: string, attr: string): string => {
    const m = s.match(new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["']`, 'i'));
    return m?.[1] ?? '';
  };
  // Feed-Titel: erstes <title> im channel/feed-Header
  const feedTitle = pick(xml, 'title') || 'Feed';
  // Einträge: <item> (RSS) oder <entry> (Atom)
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const entries = blocks.slice(0, 10).map((b) => {
    const title = pick(b, 'title') || '(ohne Titel)';
    let link = pick(b, 'link');
    if (!link) link = pickAttr(b, 'link', 'href'); // Atom
    const key = pick(b, 'guid') || pick(b, 'id') || link || pick(b, 'pubDate') || pick(b, 'updated') || title;
    return { title, link, key };
  });
  return { title: feedTitle, entries };
}

export async function skillRss(ctx: SkillContext): Promise<SkillResult> {
  const msg = ctx.message.trim();

  // /feeds — auflisten
  if (/^\/feeds\b/i.test(msg)) {
    const { data: feeds } = await ctx.supabase
      .from("rss_feeds").select("feed_title, feed_url")
      .eq("user_id", ctx.user_id).order("created_at", { ascending: true });
    if (!feeds || feeds.length === 0) {
      return { reply: "📰 Du hast noch keine Feeds abonniert. Probier: /rss https://www.tagesschau.de/xml/rss2" };
    }
    const list = feeds.map((f: any, i: number) => `${i + 1}. ${f.feed_title || f.feed_url}`).join("\n");
    return { reply: `📰 Deine Feeds:\n${list}\n\nZum Abbestellen: /unfeed und die Nummer, z.B. /unfeed 1` };
  }

  // /unfeed <n> — entfernen
  const unfeedM = msg.match(/^\/unfeed\s+(\d+)/i);
  if (unfeedM) {
    const idx = parseInt(unfeedM[1]) - 1;
    const { data: feeds } = await ctx.supabase
      .from("rss_feeds").select("id, feed_title")
      .eq("user_id", ctx.user_id).order("created_at", { ascending: true });
    if (!feeds || idx < 0 || idx >= feeds.length) {
      return { reply: `Kein Feed mit Nummer ${idx + 1}. /feeds zeigt deine Liste.` };
    }
    await ctx.supabase.from("rss_feeds").delete().eq("id", feeds[idx].id);
    return { reply: `🗑️ Feed „${feeds[idx].feed_title}" entfernt.` };
  }

  // /rss <url> — abonnieren
  const urlM = msg.match(/\/rss\s+(\S+)/i);
  const url = urlM?.[1]?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { reply: "Schick mir eine Feed-URL: /rss https://www.tagesschau.de/xml/rss2" };
  }

  try {
    const r = await fetch(url, { headers: { "User-Agent": "Earth01-RSS/1.0" } });
    if (!r.ok) return { reply: `Die Seite antwortet mit Fehler ${r.status}. Ist die URL korrekt?` };
    const xml = await r.text();
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) {
      return { reply: "Das sieht nicht nach einem RSS-/Atom-Feed aus. Such auf der Seite nach dem RSS-Symbol oder einer .xml-Adresse." };
    }
    const parsed = parseFeed(xml);
    const newestKey = parsed.entries[0]?.key ?? '';

    const { error } = await ctx.supabase.from("rss_feeds").upsert({
      user_id: ctx.user_id,
      feed_url: url,
      feed_title: parsed.title.slice(0, 200),
      last_entry_key: newestKey,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: "user_id,feed_url" });
    if (error) return { reply: `Konnte den Feed nicht speichern: ${error.message}` };

    const preview = parsed.entries[0]?.title ?? '';
    return {
      reply: `📰 Abonniert: „${parsed.title}"\n\nNeuester Eintrag: ${preview}\n\nAb jetzt schick ich dir neue Einträge automatisch.\n\n• /feeds — deine Abos anzeigen\n• /unfeed 1 — Abo Nummer 1 abbestellen`,
    };
  } catch (e) {
    return { reply: `Feed konnte nicht geladen werden: ${(e as Error).message}` };
  }
}

// ─── Browser-Skills auch als Bot-Befehle ──────────────────

export async function skillDice(ctx: SkillContext): Promise<SkillResult> {
  const isCoin = /m[üu]nze/i.test(ctx.message);
  if (isCoin) {
    return { reply: Math.random() < 0.5 ? "🪙 Kopf" : "🪙 Zahl" };
  }
  const n = Math.ceil(Math.random() * 6);
  return { reply: `🎲 ${["⚀","⚁","⚂","⚃","⚄","⚅"][n-1]} — eine ${n}` };
}

export async function skillHash(ctx: SkillContext): Promise<SkillResult> {
  if (/\/uuid/i.test(ctx.message)) {
    return { reply: `🆔 Neue UUID:\n${crypto.randomUUID()}` };
  }
  const m = ctx.message.match(/\/hash\s+(.+)/i);
  const text = (m?.[1] ?? "").trim();
  if (!text) return { reply: "Schick: /hash <dein Text> — ich geb dir den SHA-256-Fingerabdruck. Oder /uuid für eine einmalige ID." };
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  return { reply: `🔐 SHA-256 von „${text.slice(0, 40)}":\n${hex}` };
}

export async function skillPassword(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/\/passwort\s+(\d+)/i) || ctx.message.match(/\/password\s+(\d+)/i);
  let len = m ? parseInt(m[1]) : 20;
  len = Math.max(8, Math.min(64, len));
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*+-=?";
  const rnd = new Uint32Array(len);
  crypto.getRandomValues(rnd);
  const pw = [...rnd].map(r => chars[r % chars.length]).join("");
  return { reply: `🔑 Sicheres Passwort (${len} Zeichen):\n${pw}\n\nLänge ist wichtiger als Sonderzeichen — je länger, desto sicherer. Mit /passwort 32 kriegst du ein längeres.` };
}

export async function skillQr(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/\/qr\s+(.+)/i);
  const text = (m?.[1] ?? "").trim();
  if (!text) return { reply: "Schick: /qr <Text oder Link> — ich mach einen QR-Code draus." };
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    if (!r.ok) return { reply: `QR-Dienst antwortet mit Fehler ${r.status}.` };
    const blob = await r.blob();
    return { reply: "", image: blob, imageCaption: `📱 QR-Code für: ${text.slice(0, 80)}` };
  } catch (e) {
    return { reply: `QR-Code konnte nicht erstellt werden: ${(e as Error).message}` };
  }
}
