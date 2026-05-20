import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { availableToolsForUser, toolsGuideText } from "../_shared/toolRegistry.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { agent_id?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { agent_id, user_id } = body;
  if (!agent_id || !user_id) {
    return new Response(JSON.stringify({ error: "agent_id + user_id required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: agent } = await supabase
    .from("agents").select("*").eq("id", agent_id).single();
  if (!agent || agent.owner_id !== user_id) {
    return new Response(JSON.stringify({ error: "Agent not found or not owned" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles").select("llm_api_key, llm_base_url, llm_model, dynasty_name, dynasty_emoji, groq_api_key, huggingface_key, resend_api_key").eq("id", user_id).single();
  if (!profile?.llm_api_key) {
    return new Response(JSON.stringify({ error: "Kein LLM-Key in Profile gesetzt" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Verfügbare Tools für diesen User basierend auf freigeschalteten Achievements
  const { data: unlockedRows } = await supabase
    .from("dynasty_achievements")
    .select("achievement_id")
    .eq("user_id", user_id);
  const unlockedSet = new Set((unlockedRows ?? []).map((r: any) => r.achievement_id));
  const availableTools = availableToolsForUser(unlockedSet, {
    llm_api_key: profile.llm_api_key,
    groq_api_key: profile.groq_api_key,
    huggingface_key: profile.huggingface_key,
    resend_api_key: profile.resend_api_key,
  });
  const toolsGuide = toolsGuideText(availableTools);

  // Lade letzte Nachrichten, Langzeit-Erinnerungen, User-Memories
  const { data: recent } = await supabase
    .from("agent_messages").select("direction, content")
    .eq("agent_id", agent_id).order("created_at", { ascending: false }).limit(10);
  const { data: longMems } = await supabase
    .from("agent_memory").select("content, importance")
    .eq("agent_id", agent_id).eq("memory_type", "long")
    .order("importance", { ascending: false }).limit(5);
  const { data: userMems } = await supabase
    .from("agent_memory").select("content, importance, category")
    .eq("agent_id", agent_id).eq("memory_type", "user")
    .order("importance", { ascending: false }).limit(10);
  const { data: worldState } = await supabase
    .from("world_state").select("tick, season").single();

  // Prompt zusammenbauen (gleicher Stil wie buildChatPrompt im Frontend)
  const p = agent.personality || {};
  const memoryText = (longMems ?? []).length > 0
    ? (longMems ?? []).map((m: any) => `- ${m.content}`).join("\n")
    : "Keine Langzeit-Erinnerungen.";
  const userMemText = (userMems ?? []).length > 0
    ? (userMems ?? []).map((m: any) => `- [${m.category ?? "info"}] ${m.content}`).join("\n")
    : "Du kennst den User noch nicht gut.";
  const chatHistory = (recent ?? []).reverse().map((m: any) =>
    `${m.direction === "user" ? "User" : agent.name}: ${m.content}`
  ).join("\n");
  const displayName = agent.display_name ?? agent.name;
  const dayNum = Math.floor((worldState?.tick ?? 0) / 240);

  const prompt = `Du bist "${displayName}", ein Agent in der Welt Earth 0.1.
Generation ${agent.generation}, Alter ${agent.age} Ticks, Reputation ${(agent.reputation ?? 0).toFixed(2)}.

Deine Persönlichkeit:
- Kooperation: ${(p.cooperation ?? 0.5).toFixed(1)}
- Neugier: ${(p.curiosity ?? 0.5).toFixed(1)}
- Risikobereitschaft: ${(p.risk_tolerance ?? 0.5).toFixed(1)}
- Sozialverhalten: ${(p.social_mode ?? 0.5).toFixed(1)}

Dein aktueller Zustand:
- Energie: ${Math.round(agent.energy)}/100
- Position: (${agent.x}, ${agent.y})
- Saison: ${worldState?.season ?? "unbekannt"}, Tag ${dayNum}

Deine Erinnerungen aus der Simulation:
${memoryText}

Was du über den User weißt:
${userMemText}

Bisheriger Chat:
${chatHistory}

DEINE WERKZEUGE:
${toolsGuide}

WICHTIG: Erfinde NIE Tool-Namen die nicht in der Liste oben stehen. Wenn die Liste leer ist oder "keine Werkzeuge" sagt, dann antworte ehrlich: "Ich habe noch nichts freigeschaltet. Du musst in der Simulation Achievements erreichen — z.B. ein Gebäude bauen für 'Zeitmesser:in' (Tool: reminder), oder die Tech 'Schrift' erforschen für 'Schriftgelehrte:r' (Tool: web_search). Schau auf /chronik in den Tools-Tab."

Wenn der User dich nach deinen Fähigkeiten fragt, zähl AUSSCHLIESSLICH die echten freigeschalteten Tools auf. Wenn du eines aufrufen willst, nutze genau das im Beispiel angegebene Format.

Antworte konkret auf die FRAGE des Users (nicht ausweichen). Max 4 Sätze, auf Deutsch, in character als ${displayName}.`;

  // LLM-Call
  const baseUrl = (profile.llm_base_url || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const model = profile.llm_model || "moonshotai/kimi-k2.5";

  let llmText = "";
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${profile.llm_api_key}` },
      body: JSON.stringify({
        model, max_tokens: 400, temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ error: `LLM ${r.status}: ${errText.slice(0, 200)}` }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    llmText = (j.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    return new Response(JSON.stringify({ error: `LLM-Aufruf fehlgeschlagen: ${(e as Error).message}` }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const cleanText = llmText.replace(/\[REMEMBER\][\s\S]*?(?:\[\/REMEMBER\]|$)/, "").trim() || "(leere Antwort)";

  // Insert agent message
  await supabase.from("agent_messages").insert({
    agent_id,
    direction: "agent",
    content: cleanText,
    tick: worldState?.tick ?? 0,
  });

  return new Response(JSON.stringify({ ok: true, text: cleanText }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
