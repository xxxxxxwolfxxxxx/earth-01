// Skill-Handler für die 11 action-typ Skills (Telegram-Pattern → Antwort).
// Browser-typ Skills (qr_code, dice, math_practice, hash_tools, password_gen, leak_check)
// werden ausschließlich im Frontend gehandhabt.

import { BOT } from "./botMessages.ts";

export interface SkillContext {
  supabase: any;
  user_id: string;
  message: string;
}

export interface SkillResult {
  reply: string;
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
    default: return { reply: BOT.unknown_command() };
  }
}
