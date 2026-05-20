import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchSkill } from "../_shared/skillRegistry.ts";
import { executeSkill } from "../_shared/skillHandlers.ts";
import { BOT } from "../_shared/botMessages.ts";
import { transcribeTelegramVoice } from "../_shared/transcribe.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Webhook-Secret prüfen
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, telegram_bot_token, telegram_chat_id, whisper_key, llm_api_key")
    .eq("telegram_webhook_secret", secret)
    .single();
  if (!profile) {
    return new Response(JSON.stringify({ error: "bad secret" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const msg = update?.message;
  if (!msg) return new Response("ok-no-msg", { headers: CORS });

  // ── Voice / Audio: transkribieren und wie Text weiterbehandeln ──
  let text = (msg.text ?? "").trim();
  if (!text && (msg.voice || msg.audio)) {
    const voice = msg.voice ?? msg.audio;
    const transcript = await transcribeTelegramVoice({
      botToken: profile.telegram_bot_token,
      voice: { file_id: voice.file_id, mime_type: voice.mime_type },
      whisperKey: profile.whisper_key,
      llmKey: profile.llm_api_key,
    });
    if (!transcript.ok || !transcript.text) {
      await sendTelegram(profile.telegram_bot_token, msg.chat.id,
        `🎤 Konnte deine Sprachnachricht nicht verstehen: ${transcript.error ?? "Unbekannter Fehler"}`);
      return new Response("ok-voice-fail", { headers: CORS });
    }
    text = transcript.text.trim();
    // Kurze Bestätigung was verstanden wurde
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, `🎤 „${text}"`);
  }

  if (!text) return new Response("ok-no-text", { headers: CORS });

  // chat_id aktualisieren falls noch nicht gesetzt
  if (!profile.telegram_chat_id && msg.chat?.id) {
    await supabase.from("profiles").update({ telegram_chat_id: String(msg.chat.id) }).eq("id", profile.id);
  }

  // Slash-Commands: /start, /help
  if (text === "/start" || text === "/help") {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id,
      `Hallo! Dein Bot lebt. Schalt auf https://earth-01.netlify.app/tech-tree Fähigkeiten frei — danach versteht er die passenden Befehle.`);
    return new Response("ok", { headers: CORS });
  }

  // Skill-Match
  const skill = matchSkill(text);
  if (!skill) {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, BOT.unknown_command());
    return new Response("ok-no-match", { headers: CORS });
  }

  // Hat User den Skill freigeschaltet?
  const { data: unlocked } = await supabase
    .from("user_skills").select("skill_id").eq("user_id", profile.id).eq("skill_id", skill.id).maybeSingle();

  if (!unlocked) {
    // Offene Lesson-Session für diesen Skill?
    const { data: session } = await supabase
      .from("lesson_sessions")
      .select("id, state")
      .eq("user_id", profile.id)
      .eq("skill_id", skill.id)
      .eq("state", "task")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (session) {
      // Lesson-Verifikation: Skill ausführen UND als gelernt markieren
      const ctx = { supabase, user_id: profile.id, message: text };
      const result = await executeSkill(skill.id, ctx);
      await supabase.from("lesson_sessions").update({ state: "verified", completed_at: new Date().toISOString() }).eq("id", session.id);
      await supabase.from("user_skills").upsert({ user_id: profile.id, skill_id: skill.id }, { onConflict: "user_id,skill_id" });
      await sendTelegram(profile.telegram_bot_token, msg.chat.id,
        `${result.reply}\n\n✓ Skill '${skill.id}' freigeschaltet — schau auf der Plattform den Tech-Tree an.`);
      return new Response("ok-verified", { headers: CORS });
    }
    // Skill nicht freigeschaltet, keine offene Lesson
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, BOT.needs_skill(skill.id));
    return new Response("ok-locked", { headers: CORS });
  }

  // Skill ist freigeschaltet: einfach ausführen
  const ctx = { supabase, user_id: profile.id, message: text };
  const result = await executeSkill(skill.id, ctx);
  await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);

  // Usage-Log
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("skill_usage_log")
    .select("count")
    .eq("user_id", profile.id).eq("skill_id", skill.id).eq("date", today).maybeSingle();
  if (existing) {
    await supabase.from("skill_usage_log").update({ count: existing.count + 1 }).eq("user_id", profile.id).eq("skill_id", skill.id).eq("date", today);
  } else {
    await supabase.from("skill_usage_log").insert({ user_id: profile.id, skill_id: skill.id, date: today, count: 1 });
  }

  return new Response("ok", { headers: CORS });
});

async function sendTelegram(token: string | null, chat_id: any, text: string): Promise<void> {
  if (!token || !chat_id) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
    });
  } catch (e) { console.warn("Telegram send failed:", e); }
}
