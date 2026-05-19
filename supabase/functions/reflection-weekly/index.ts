import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, main_agent_id, dynasty_name, dynasty_emoji, telegram_bot_token, telegram_chat_id, llm_api_key, llm_base_url, llm_model")
    .eq("id", userId).single();
  if (!profile?.main_agent_id || !profile?.llm_api_key) {
    return new Response(JSON.stringify({ error: "Needs main_agent and llm_api_key" }), { status: 400 });
  }

  // Hole die letzten 14 Tage Events der Familie
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data: events } = await supabase
    .from("world_events")
    .select("*")
    .gte("created_at", since)
    .or(`detail->>user_id.eq.${userId}`)
    .order("tick", { ascending: false })
    .limit(50);

  const summary = (events ?? []).map((e: any) =>
    `[Tick ${e.tick}] ${e.event_type}: ${JSON.stringify(e.detail).slice(0, 150)}`
  ).join("\n");

  const baseUrl = profile.llm_base_url || "https://integrate.api.nvidia.com/v1";
  const model = profile.llm_model || "moonshotai/kimi-k2.5";
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${profile.llm_api_key}` },
    body: JSON.stringify({
      model, max_tokens: 600, temperature: 0.7,
      messages: [
        { role: "system", content: `Du bist ${profile.dynasty_name}. Reflektiere die letzten 2 Wochen deiner Familie. Was war wichtig? Was hast du gelernt? Was steht an? Maximal 200 Wörter, persönlicher Ton.` },
        { role: "user", content: `Letzte Ereignisse:\n${summary || "(keine Ereignisse aufgezeichnet)"}` },
      ],
    }),
  });
  const j = await r.json();
  const text = j.choices?.[0]?.message?.content?.trim() ?? "(kein Inhalt)";

  if (profile.telegram_bot_token && profile.telegram_chat_id) {
    await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: `${profile.dynasty_emoji ?? "📜"} <b>Wochen-Reflektion</b>\n\n${text}`,
        parse_mode: "HTML",
      }),
    });
  }

  return new Response(JSON.stringify({ text }), { headers: { "Content-Type": "application/json" }});
});
