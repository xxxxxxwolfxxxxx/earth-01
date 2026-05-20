// Briefing-Builder: sammelt Daten aus mehreren Quellen und baut Tagesreport.

export interface BriefingArgs {
  supabase: any;
  userId: string;
  city?: string;
  includeWeather: boolean;
  includeReminders: boolean;
  includeMood: boolean;
  includeHabits: boolean;
}

async function fetchWeather(city: string): Promise<string> {
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`);
    const gj = await geo.json();
    const place = gj.results?.[0];
    if (!place) return `🌤️ ${city}: nicht gefunden`;
    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`);
    const wxj = await wx.json();
    const c = wxj.current ?? {};
    const d = wxj.daily ?? {};
    const max = d.temperature_2m_max?.[0];
    const min = d.temperature_2m_min?.[0];
    const rain = d.precipitation_sum?.[0];
    return `🌤️ <b>${place.name}</b>: ${c.temperature_2m}°C jetzt, heute ${min}–${max}°C${rain > 0.1 ? `, ${rain}mm Regen` : ""}`;
  } catch {
    return `🌤️ Wetter nicht verfügbar`;
  }
}

async function fetchRemindersToday(supabase: any, userId: string): Promise<string> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const { data } = await supabase
    .from("reminders")
    .select("content, remind_at")
    .eq("user_id", userId)
    .eq("delivered", false)
    .gte("remind_at", start.toISOString())
    .lte("remind_at", end.toISOString())
    .order("remind_at", { ascending: true })
    .limit(10);
  if (!data || data.length === 0) return `📅 Heute keine Erinnerungen.`;
  const lines = data.map((r: any) => {
    const t = new Date(r.remind_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return `  • ${t} — ${r.content}`;
  });
  return `📅 <b>Heute</b>:\n${lines.join("\n")}`;
}

async function fetchMoodTrend(supabase: any, userId: string): Promise<string> {
  const since = new Date(); since.setDate(since.getDate() - 7);
  const { data } = await supabase
    .from("user_data")
    .select("value, key")
    .eq("user_id", userId)
    .eq("namespace", "mood")
    .gte("key", since.toISOString().slice(0, 10))
    .order("key", { ascending: false })
    .limit(7);
  if (!data || data.length === 0) return `😊 Noch keine Stimmungs-Einträge diese Woche.`;
  const scores = data.map((r: any) => r.value?.score ?? 0).filter((s: number) => s > 0);
  if (scores.length === 0) return `😊 Noch keine Stimmungs-Einträge diese Woche.`;
  const avg = (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1);
  const trend = scores[0] > scores[scores.length - 1] ? "↗" : scores[0] < scores[scores.length - 1] ? "↘" : "→";
  return `😊 <b>Stimmung 7d</b>: Ø ${avg}/5 ${trend} (${scores.length} Einträge)`;
}

async function fetchHabitStreaks(supabase: any, userId: string): Promise<string> {
  const since = new Date(); since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from("user_data")
    .select("key, value")
    .eq("user_id", userId)
    .eq("namespace", "habits")
    .gte("key", since.toISOString().slice(0, 10));
  if (!data || data.length === 0) return `💪 Noch keine Gewohnheiten dokumentiert.`;
  // Habits pro Name gruppieren
  const habits: Record<string, string[]> = {};
  for (const r of data) {
    const [name, date] = (r.key as string).split(":");
    if (!habits[name]) habits[name] = [];
    if (date) habits[name].push(date);
  }
  // Streak pro Habit berechnen (aufeinanderfolgende Tage rückwärts ab heute)
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  for (const [name, dates] of Object.entries(habits)) {
    const sorted = dates.slice().sort().reverse();
    let streak = 0;
    const check = new Date();
    for (let i = 0; i < 30; i++) {
      const ds = check.toISOString().slice(0, 10);
      if (sorted.includes(ds)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
    if (streak > 0) lines.push(`  • ${name}: 🔥 ${streak} Tage`);
  }
  if (lines.length === 0) return `💪 Habit-Streaks: aktuell keine aktiv.`;
  return `💪 <b>Habit-Streaks</b>:\n${lines.join("\n")}`;
}

export async function buildBriefing(args: BriefingArgs): Promise<string> {
  const dateStr = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const parts: string[] = [`🌅 <b>Guten Morgen — ${dateStr}</b>`];

  if (args.includeWeather && args.city) {
    parts.push(await fetchWeather(args.city));
  }
  if (args.includeReminders) {
    parts.push(await fetchRemindersToday(args.supabase, args.userId));
  }
  if (args.includeMood) {
    parts.push(await fetchMoodTrend(args.supabase, args.userId));
  }
  if (args.includeHabits) {
    parts.push(await fetchHabitStreaks(args.supabase, args.userId));
  }
  return parts.join("\n\n");
}
