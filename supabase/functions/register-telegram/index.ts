import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bot_token } = await req.json();
    if (!bot_token || typeof bot_token !== "string" || bot_token.length < 20) {
      return new Response(JSON.stringify({ error: "Bot-Token fehlt oder ungültig" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getMeRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const getMeData = await getMeRes.json();
    if (!getMeData.ok) {
      return new Response(JSON.stringify({ error: "Telegram-Token ungültig. Prüfe den Token vom BotFather." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botInfo = getMeData.result;
    const webhookSecret = crypto.randomUUID();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?secret=${webhookSecret}`;

    const setWebhookRes = await fetch(
      `https://api.telegram.org/bot${bot_token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );
    const setWebhookData = await setWebhookRes.json();
    if (!setWebhookData.ok) {
      return new Response(JSON.stringify({ error: "Webhook konnte nicht gesetzt werden: " + setWebhookData.description }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        telegram_bot_token: bot_token,
        telegram_webhook_secret: webhookSecret,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Profil-Update fehlgeschlagen: " + updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, bot: { name: botInfo.first_name, username: botInfo.username } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
