// register-telegram
// HTTP POST mit Auth-Header. Drei Aktionen:
//   action='register' (default): liest telegram_bot_token aus dem Profil,
//     prüft via getMe, setzt webhook_secret und ruft setWebhook auf.
//   action='test': sendet eine Test-Nachricht an die gespeicherte chat_id.
//   action='unregister': löscht Webhook + Profil-Felder.
// Akzeptiert optional bot_token im Body — wird dann ins Profil geschrieben (Kompat).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function rand(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Nicht angemeldet" }, 401);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Token ungültig" }, 401);

    let body: any = {};
    try { body = await req.json(); } catch { /* leerer Body ok */ }
    const action = body?.action ?? "register";

    // Profil laden
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_webhook_secret, telegram_chat_id, bot_name")
      .eq("id", user.id)
      .single();
    if (!profile) return json({ error: "Profil nicht gefunden" }, 404);

    // ─── UNREGISTER ───
    if (action === "unregister") {
      if (profile.telegram_bot_token) {
        try {
          await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/deleteWebhook`, { method: "POST" });
        } catch { /* egal */ }
      }
      await supabase.from("profiles").update({
        telegram_bot_token: null,
        telegram_webhook_secret: null,
        telegram_chat_id: null,
        telegram_linked_at: null,
      }).eq("id", user.id);
      return json({ ok: true, unregistered: true });
    }

    // ─── TEST ───
    if (action === "test") {
      if (!profile.telegram_bot_token) return json({ error: "Kein Bot-Token gespeichert" }, 400);
      if (!profile.telegram_chat_id) {
        return json({ error: "Schreib dem Bot zuerst /start in Telegram, damit er deine Chat-ID kennt." }, 400);
      }
      const r = await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: profile.telegram_chat_id,
          text: "✓ Verbindung läuft. Dein Bot ist startklar.",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return json({ error: j.description || `Telegram ${r.status}` }, 502);
      return json({ ok: true, sent: true });
    }

    // ─── REGISTER ───
    // Optional: bot_token im Body überschreibt das Profil (Kompatibilität alter Flow)
    let botToken = profile.telegram_bot_token;
    if (body?.bot_token && typeof body.bot_token === "string" && body.bot_token.length >= 20) {
      botToken = body.bot_token;
    }
    if (!botToken) {
      return json({ error: "Erst einen Bot-Token auf /keys speichern." }, 400);
    }

    // getMe — prüft Token + holt Bot-Username
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meJson = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !meJson.ok) {
      return json({ error: meJson.description || `Telegram-Token ungültig (${meRes.status})` }, 400);
    }
    const botInfo = meJson.result;

    // Webhook-Secret behalten oder neu generieren
    const secret = profile.telegram_webhook_secret || rand();
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?secret=${secret}`;

    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    });
    const setJson = await setRes.json().catch(() => ({}));
    if (!setRes.ok || !setJson.ok) {
      return json({ error: setJson.description || `setWebhook ${setRes.status}` }, 502);
    }

    // Profil updaten (Token + Secret + Timestamp + Bot-Identität)
    // bot_name nur setzen, wenn der User noch keinen eigenen Namen vergeben hat —
    // wir wollen seine Wahl nicht überschreiben.
    const updates: Record<string, unknown> = {
      telegram_bot_token: botToken,
      telegram_webhook_secret: secret,
      telegram_linked_at: new Date().toISOString(),
      bot_username: botInfo.username,
    };
    if (!profile.bot_name) {
      updates.bot_name = botInfo.first_name || botInfo.username;
    }
    await supabase.from("profiles").update(updates).eq("id", user.id);

    return json({
      ok: true,
      bot: {
        username: botInfo.username,
        first_name: botInfo.first_name,
        id: botInfo.id,
      },
      deep_link: `https://t.me/${botInfo.username}`,
    });
  } catch (e) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});
