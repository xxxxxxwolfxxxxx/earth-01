import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT } from "../_shared/botMessages.ts";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("reminders")
    .select("id, user_id, content")
    .lte("remind_at", now)
    .eq("delivered", false)
    .limit(50);

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), { headers: { "Content-Type": "application/json" }});
  }

  let fired = 0;
  for (const r of due) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("id", r.user_id).single();

    if (profile?.telegram_bot_token && profile?.telegram_chat_id) {
      try {
        await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: BOT.reminder_fire(r.content),
            parse_mode: "HTML",
          }),
        });
      } catch (e) { /* swallow */ }
    }
    await supabase.from("reminders").update({ delivered: true }).eq("id", r.id);
    fired++;
  }

  return new Response(JSON.stringify({ fired }), { headers: { "Content-Type": "application/json" }});
});
