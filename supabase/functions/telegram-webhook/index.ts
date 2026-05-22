import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchSkill } from "../_shared/skillRegistry.ts";
import { executeSkill, buildCloudConfig, llmAnswer } from "../_shared/skillHandlers.ts";
import { BOT } from "../_shared/botMessages.ts";
import { transcribeTelegramVoice } from "../_shared/transcribe.ts";
import { ingestNote } from "../_shared/memoryIngest.ts";
import { findRelevant } from "../_shared/ragQuery.ts";
import { synthesize } from "../_shared/tts.ts";

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
    .select("id, telegram_bot_token, telegram_chat_id, whisper_key, llm_api_key, llm_base_url, llm_model, elevenlabs_key, huggingface_key, cloud_provider, rag_sources, gdrive_refresh_token, gdrive_folder_id, github_pat, github_gist_id, bot_name, bot_role, bot_tone, bot_extra")
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
  let inputWasVoice = false;
  if (!text && (msg.voice || msg.audio)) {
    inputWasVoice = true;
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

  // Befehlsmenü synchronisieren: alle freigeschalteten Skills als /-Vorschläge.
  // Fire-and-forget, blockiert die Antwort nicht.
  syncBotCommands(supabase, profile.telegram_bot_token, msg.chat?.id, profile.id)
    .catch((e) => console.warn("syncBotCommands:", (e as Error).message));

  // Slash-Commands: /start, /help
  if (text === "/start" || text === "/help") {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id,
      `Hallo! Dein Bot lebt. Schalt auf https://earth-01.netlify.app/tech-tree Fähigkeiten frei — danach versteht er die passenden Befehle.`);
    return new Response("ok", { headers: CORS });
  }

  // Skill-Match
  const skill = matchSkill(text);
  if (!skill) {
    // Auto-Recall-Fallback: User hat auto_recall freigeschaltet + Cloud + HF-Key?
    const { data: hasRecall } = await supabase
      .from("user_skills").select("skill_id")
      .eq("user_id", profile.id).eq("skill_id", "auto_recall").maybeSingle();
    if (hasRecall && profile.cloud_provider && profile.huggingface_key && profile.llm_api_key) {
      try {
        const cloudConfig = await buildCloudConfig(supabase, profile.id, profile);
        const hits = await findRelevant({
          supabase, userId: profile.id, query: text,
          hfKey: profile.huggingface_key, cloudConfig, topK: 3,
        });
        const top = hits[0];
        if (top && top.similarity > 0.78) {
          const context = hits.map((h, i) => `(${i + 1}) ${h.text}`).join("\n\n");
          const reply = await llmAnswer(profile, text, context);
          await sendTelegram(profile.telegram_bot_token, msg.chat.id,
            `${reply}\n\n📚 (Aus deinen Notizen)`);
          return new Response("ok-autorecall", { headers: CORS });
        }
      } catch (e) {
        console.warn("auto_recall fehlgeschlagen:", (e as Error).message);
      }
    }
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
      if (result.image) {
        await sendTelegramPhoto(profile.telegram_bot_token, msg.chat.id, result.image, result.imageCaption ?? "");
      }
      if (result.voice) {
        await sendTelegramAudio(profile.telegram_bot_token, msg.chat.id, result.voice, result.voiceCaption ?? "");
      }
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

  if (result.image) {
    await sendTelegramPhoto(profile.telegram_bot_token, msg.chat.id, result.image, result.imageCaption ?? "");
    if (result.reply) {
      await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);
    }
  } else if (result.voice) {
    await sendTelegramAudio(profile.telegram_bot_token, msg.chat.id, result.voice, result.voiceCaption ?? "");
    if (result.reply) {
      await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);
    }
  } else if (inputWasVoice && result.reply && profile.elevenlabs_key) {
    // Mirror-Modus: User sprach, Bot spricht zurück — wenn voice_out freigeschaltet
    const { data: hasVoiceOut } = await supabase
      .from("user_skills").select("skill_id")
      .eq("user_id", profile.id).eq("skill_id", "voice_out").maybeSingle();
    if (hasVoiceOut) {
      const tts = await synthesize(result.reply, profile.elevenlabs_key);
      if (tts.ok && tts.blob) {
        await sendTelegramAudio(profile.telegram_bot_token, msg.chat.id, tts.blob, "");
      } else {
        // Fallback Text
        await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);
      }
    } else {
      await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);
    }
  } else {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);
  }

  // RAG-Ingestion: bei notes/mood/habits Schreibvorgängen Notiz in Cloud + Index spiegeln
  if (["notes", "mood", "habits"].includes(skill.id) && profile.cloud_provider && profile.huggingface_key) {
    const sourceMap: Record<string, string> = { notes: "note", mood: "mood", habits: "habit" };
    const sourceType = sourceMap[skill.id];
    const sources = profile.rag_sources ?? ["note"];
    if (sources.includes(sourceType)) {
      try {
        const cloudConfig = await buildCloudConfig(supabase, profile.id, profile);
        await ingestNote({
          supabase, userId: profile.id, text,
          sourceType: sourceType as any,
          hfKey: profile.huggingface_key,
          cloudConfig,
        });
      } catch (e) {
        console.warn(`Ingest failed: ${(e as Error).message}`);
      }
    }
  }

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

  // Live-Earth-Aktivität: wenn der User einen Standort hat, sende einen
  // Aktivitäts-Pulse an die Landing-Page.
  const { data: loc } = await supabase
    .from("profiles")
    .select("home_lat, home_lon")
    .eq("id", profile.id)
    .single();
  if (loc?.home_lat != null && loc?.home_lon != null) {
    await supabase.from("agent_activity").insert({
      user_id: profile.id,
      lat: loc.home_lat,
      lon: loc.home_lon,
      skill_id: skill.id,
    });
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

async function sendTelegramPhoto(token: string, chat_id: any, blob: Blob, caption: string): Promise<void> {
  if (!token || !chat_id) return;
  try {
    const form = new FormData();
    form.append("chat_id", String(chat_id));
    form.append("caption", caption);
    form.append("photo", blob, "image.png");
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
  } catch (e) { console.warn("Telegram sendPhoto failed:", e); }
}

async function sendTelegramAudio(token: string, chat_id: any, blob: Blob, caption: string): Promise<void> {
  if (!token || !chat_id) return;
  try {
    const form = new FormData();
    form.append("chat_id", String(chat_id));
    if (caption) form.append("caption", caption);
    form.append("audio", blob, "reply.mp3");
    await fetch(`https://api.telegram.org/bot${token}/sendAudio`, {
      method: "POST",
      body: form,
    });
  } catch (e) { console.warn("Telegram sendAudio failed:", e); }
}

// ─── Befehlsmenü-Sync ─────────────────────────────────────
// Telegram zeigt beim Tippen von "/" ein Menü — aber nur mit Befehlen,
// die per setMyCommands registriert sind. Wir setzen pro Chat genau die
// Befehle, die der User freigeschaltet hat.
// Pro Skill ein oder mehrere /-Befehle fürs Telegram-Menü.
const SKILL_COMMANDS: Record<string, { command: string; description: string }[]> = {
  weather:      [{ command: "wetter",    description: "Wetter einer Stadt" }],
  web_search:   [{ command: "suche",     description: "Das Web durchsuchen" }],
  wikipedia:    [{ command: "wiki",      description: "Wikipedia-Kurzfassung" }],
  currency:     [{ command: "kurs",      description: "Währungen umrechnen" }],
  countries:    [{ command: "land",      description: "Infos zu einem Land" }],
  notes:        [{ command: "notiz",     description: "Notiz speichern / anzeigen" }],
  mood:         [{ command: "stimmung",  description: "Stimmung 1-5 eintragen" }],
  habits:       [{ command: "habit",     description: "Gewohnheit abhaken" }],
  reminder:     [{ command: "erinner",   description: "Erinnerung setzen" }],
  pomodoro:     [{ command: "pomodoro",  description: "25-Minuten-Fokus-Timer" }],
  joke_quote:   [{ command: "witz",      description: "Einen Witz" },
                 { command: "zitat",     description: "Ein berühmtes Zitat" }],
  ask_memory:   [{ command: "frag",      description: "Deine Notizen durchsuchen" }],
  quota_check:  [{ command: "quota",     description: "API-Limits anzeigen" }],
  image_gen:    [{ command: "bild",      description: "Bild generieren lassen" }],
  voice_out:    [{ command: "sage",      description: "Bot antwortet per Sprache" }],
  mail_send:    [{ command: "mail",      description: "E-Mail verschicken" }],
  chat:         [{ command: "chat",      description: "Frei mit dem Bot reden" }],
  teamwork:     [{ command: "arbeiten",  description: "Bot zur Schwarm-Arbeit schicken" },
                 { command: "credits",   description: "Dein Guthaben anzeigen" }],
  rss:          [{ command: "rss",       description: "RSS-Feed abonnieren" },
                 { command: "feeds",     description: "Deine RSS-Abos anzeigen" }],
  dice:         [{ command: "wuerfel",   description: "Würfeln oder Münze werfen" }],
  qr_code:      [{ command: "qr",        description: "QR-Code aus Text erzeugen" }],
  hash_tools:   [{ command: "hash",      description: "SHA-256-Hash oder UUID" }],
  password_gen: [{ command: "passwort",  description: "Sicheres Passwort erzeugen" }],
};

async function syncBotCommands(supabase: any, botToken: string | null, chatId: any, userId: string) {
  if (!botToken || !chatId) return;
  const { data: unlocked } = await supabase
    .from("user_skills").select("skill_id").eq("user_id", userId);
  const commands = (unlocked ?? [])
    .flatMap((u: any) => SKILL_COMMANDS[u.skill_id] ?? [])
    .filter(Boolean);
  // /start ist immer dabei
  commands.unshift({ command: "start", description: "Bot starten / Hilfe" });
  await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands,
      scope: { type: "chat", chat_id: chatId },
    }),
  });
}
