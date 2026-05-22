import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT } from "../_shared/botMessages.ts";
import { buildBriefing } from "../_shared/briefing.ts";
import { parseFeed } from "../_shared/skillHandlers.ts";

async function sendTelegram(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch { /* swallow */ }
}

async function processReminders(supabase: any): Promise<number> {
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("reminders")
    .select("id, user_id, content")
    .lte("remind_at", now)
    .eq("delivered", false)
    .limit(50);
  if (!due || due.length === 0) return 0;

  let fired = 0;
  for (const r of due) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("id", r.user_id).single();
    if (profile?.telegram_bot_token && profile?.telegram_chat_id) {
      await sendTelegram(profile.telegram_bot_token, profile.telegram_chat_id, BOT.reminder_fire(r.content));
    }
    await supabase.from("reminders").update({ delivered: true }).eq("id", r.id);
    fired++;
  }
  return fired;
}

async function processBriefings(supabase: any): Promise<number> {
  // Alle aktiven Subscriptions laden
  const { data: subs } = await supabase
    .from("briefing_subscriptions")
    .select("user_id, hour, minute, timezone, city, include_weather, include_reminders, include_mood, include_habits, last_sent_date")
    .eq("active", true);
  if (!subs || subs.length === 0) return 0;

  let sent = 0;
  const nowUtc = new Date();
  for (const sub of subs) {
    // Lokale Zeit des Users berechnen
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: sub.timezone,
      hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(nowUtc).map(p => [p.type, p.value]));
    const localHour = parseInt(parts.hour);
    const localMinute = parseInt(parts.minute);
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;

    // Fällig? Innerhalb +/- 1 Minute Toleranz
    const dueNow = localHour === sub.hour && Math.abs(localMinute - sub.minute) <= 1;
    if (!dueNow) continue;
    // Heute schon geschickt?
    if (sub.last_sent_date === localDate) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("id", sub.user_id).single();
    if (!profile?.telegram_bot_token || !profile?.telegram_chat_id) continue;

    try {
      const briefing = await buildBriefing({
        supabase, userId: sub.user_id, city: sub.city,
        includeWeather: sub.include_weather,
        includeReminders: sub.include_reminders,
        includeMood: sub.include_mood,
        includeHabits: sub.include_habits,
      });
      await sendTelegram(profile.telegram_bot_token, profile.telegram_chat_id, briefing);
      await supabase.from("briefing_subscriptions")
        .update({ last_sent_date: localDate, updated_at: new Date().toISOString() })
        .eq("user_id", sub.user_id);
      sent++;
    } catch (e) {
      console.warn(`Briefing für ${sub.user_id} fehlgeschlagen:`, (e as Error).message);
    }
  }
  return sent;
}

// RSS-Feeds prüfen — alle ~30 Min pro Feed, neue Einträge pushen.
async function processRssFeeds(supabase: any): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: feeds } = await supabase
    .from("rss_feeds")
    .select("id, user_id, feed_url, feed_title, last_entry_key, last_checked_at")
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(40);
  if (!feeds || feeds.length === 0) return 0;

  let pushed = 0;
  for (const feed of feeds) {
    try {
      const r = await fetch(feed.feed_url, { headers: { "User-Agent": "Earth01-RSS/1.0" } });
      if (!r.ok) {
        await supabase.from("rss_feeds").update({ last_checked_at: new Date().toISOString() }).eq("id", feed.id);
        continue;
      }
      const xml = await r.text();
      const parsed = parseFeed(xml);
      // Neue Einträge = alle bis zum bekannten last_entry_key
      const newEntries: { title: string; link: string; key: string }[] = [];
      for (const e of parsed.entries) {
        if (e.key === feed.last_entry_key) break;
        newEntries.push(e);
      }
      const newestKey = parsed.entries[0]?.key ?? feed.last_entry_key;

      // Telegram-Daten des Users
      if (newEntries.length > 0 && feed.last_entry_key) {
        const { data: profile } = await supabase
          .from("profiles").select("telegram_bot_token, telegram_chat_id")
          .eq("id", feed.user_id).single();
        if (profile?.telegram_bot_token && profile?.telegram_chat_id) {
          // Max 5 pro Tick, älteste zuerst
          for (const e of newEntries.slice(0, 5).reverse()) {
            const text = `📰 <b>${feed.feed_title}</b>\n${e.title}${e.link ? `\n${e.link}` : ''}`;
            await sendTelegram(profile.telegram_bot_token, profile.telegram_chat_id, text);
            pushed++;
          }
        }
      }
      await supabase.from("rss_feeds").update({
        last_entry_key: newestKey,
        last_checked_at: new Date().toISOString(),
      }).eq("id", feed.id);
    } catch {
      await supabase.from("rss_feeds").update({ last_checked_at: new Date().toISOString() }).eq("id", feed.id);
    }
  }
  return pushed;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fired = await processReminders(supabase);
  const briefings = await processBriefings(supabase);
  const rssPushed = await processRssFeeds(supabase);

  let orchestratorResult: any = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const r = await fetch(`${supabaseUrl}/functions/v1/swarm-orchestrator`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
    });
    orchestratorResult = await r.json().catch(() => null);
  } catch (e) {
    console.warn("Orchestrator-Call fehlgeschlagen:", (e as Error).message);
  }

  return new Response(
    JSON.stringify({ fired, briefings, rss: rssPushed, swarm: orchestratorResult }),
    { headers: { "Content-Type": "application/json" } },
  );
});
