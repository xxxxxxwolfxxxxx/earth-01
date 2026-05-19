import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("agent_reminders")
    .select("id, agent_id, content")
    .lte("remind_at", now)
    .eq("delivered", false)
    .limit(50);

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), { headers: { "Content-Type": "application/json" }});
  }

  let fired = 0;
  for (const r of due) {
    const { data: agent } = await supabase
      .from("agents")
      .select("id, name, display_name, owner_id")
      .eq("id", r.agent_id)
      .single();
    if (!agent) continue;
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id, dynasty_name, dynasty_emoji")
      .eq("id", agent.owner_id)
      .single();

    const sender = profile?.dynasty_emoji || "⏰";
    const senderName = profile?.dynasty_name || agent.display_name || agent.name;
    const text = `${sender} <b>${senderName}</b> erinnert dich:\n${r.content}`;

    if (profile?.telegram_bot_token && profile?.telegram_chat_id) {
      try {
        await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text,
            parse_mode: "HTML",
          }),
        });
      } catch (e) { /* swallow */ }
    }

    await supabase.from("agent_reminders").update({ delivered: true }).eq("id", r.id);
    fired++;
  }

  return new Response(JSON.stringify({ fired }), { headers: { "Content-Type": "application/json" }});
});
