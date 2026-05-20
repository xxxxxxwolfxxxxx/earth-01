// Skill-Handler für die 11 action-typ Skills (Telegram-Pattern → Antwort).
// Browser-typ Skills (qr_code, dice, math_practice, hash_tools, password_gen, leak_check)
// werden ausschließlich im Frontend gehandhabt.

import { BOT } from "./botMessages.ts";
import { findRelevant, QueryHit } from "./ragQuery.ts";
import { CloudConfig } from "./cloudAdapters.ts";
import { generateImage } from "./imageGen.ts";
import { synthesize } from "./tts.ts";

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

export async function skillJokeQuote(_ctx: SkillContext): Promise<SkillResult> {
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
  if (!value || value < 1 || value > 5) return { reply: `Sag deinem Bot eine Zahl 1-5. Z.B. 'stimmung: 4'.` };
  await ctx.supabase.from("user_data").upsert({
    user_id: ctx.user_id,
    namespace: "mood",
    key: new Date().toISOString().slice(0, 10),
    value: { score: value },
  }, { onConflict: "user_id,namespace,key" });
  return { reply: `😊 Stimmung ${value}/5 notiert für heute.` };
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
  return { reply: `🍅 Pomodoro läuft. 25 Min Fokus, dann pingt dich dein Bot.` };
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

export async function llmAnswer(profile: any, query: string, context: string): Promise<string> {
  const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.llm_api_key}`,
    },
    body: JSON.stringify({
      model: profile.llm_model,
      messages: [
        {
          role: "system",
          content: "Du beantwortest Fragen anhand der mitgelieferten Notizen des Users. Antworte präzise auf Deutsch, nur basierend auf den Notizen. Wenn nichts Passendes dabei ist, sag das ehrlich.",
        },
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
    .select("huggingface_key, cloud_provider, gdrive_refresh_token, gdrive_folder_id, github_gist_id, github_pat, llm_api_key, llm_base_url, llm_model")
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
