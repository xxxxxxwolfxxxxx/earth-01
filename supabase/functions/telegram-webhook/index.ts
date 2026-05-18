import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_RESPONSE_TOKENS = 300;

const SEASON_DE: Record<string, string> = {
  spring: "Frühling", summer: "Sommer", autumn: "Herbst", winter: "Winter",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    if (!secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, telegram_bot_token, telegram_chat_id")
      .eq("telegram_webhook_secret", secret)
      .single();

    if (profileErr || !profile || !profile.telegram_bot_token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await req.json();
    const message = update.message;
    if (!message || !message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const botToken = profile.telegram_bot_token;

    if (!profile.telegram_chat_id) {
      await supabase
        .from("profiles")
        .update({ telegram_chat_id: chatId })
        .eq("id", profile.id);
    }

    const { data: agents } = await supabase
      .from("agents")
      .select("*")
      .eq("owner_id", profile.id)
      .eq("alive", true)
      .order("energy", { ascending: false })
      .limit(1);

    const agent = agents?.[0];
    if (!agent) {
      await sendTelegram(botToken, chatId, "Du hast keinen lebenden Agenten. Erstelle einen auf earth-01.netlify.app!");
      return new Response("OK", { status: 200 });
    }

    if (text.startsWith("/")) {
      const response = await handleCommand(text, agent, supabase, profile.id);
      await sendTelegram(botToken, chatId, response);
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("agents")
      .update({ forced_phase: "free" })
      .eq("id", agent.id);

    const { data: worldState } = await supabase
      .from("world_state")
      .select("tick, season, day_phase")
      .single();

    const currentTick = worldState?.tick ?? 0;

    await supabase.from("agent_messages").insert({
      agent_id: agent.id,
      direction: "user",
      content: text,
      tick: currentTick,
    });

    const { data: recentMessages } = await supabase
      .from("agent_messages")
      .select("direction, content")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: memories } = await supabase
      .from("agent_memory")
      .select("content, importance")
      .eq("agent_id", agent.id)
      .eq("memory_type", "long")
      .order("importance", { ascending: false })
      .limit(5);

    const prompt = buildChatPrompt(agent, recentMessages ?? [], memories ?? [], worldState);

    let replyText: string;
    try {
      replyText = await callGemini(prompt);
    } catch (err) {
      console.error("Gemini error:", err.message);
      replyText = `Ich bin gerade etwas erschöpft... Versuch es gleich nochmal! (Energie: ${Math.round(agent.energy)}/100)`;
    }

    await supabase.from("agent_messages").insert({
      agent_id: agent.id,
      direction: "agent",
      content: replyText,
      tick: currentTick,
    });

    await sendTelegram(botToken, chatId, replyText);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});

async function sendTelegram(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function handleCommand(
  text: string,
  agent: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  _userId: string
): Promise<string> {
  const cmd = text.split(" ")[0].toLowerCase();

  switch (cmd) {
    case "/start":
      return `Hallo! Ich bin *${agent.name}*, Generation ${agent.generation}. Ich lebe in der Earth 0.1 Welt.\n\nSchreib mir einfach eine Nachricht, und ich antworte dir in meiner Freizeit!\n\nCommands:\n/status — Mein Zustand\n/world — Weltzusammenfassung\n/memory — Meine Erinnerungen\n/sleep — Mich schlafen schicken\n/work — Mich arbeiten schicken`;

    case "/status": {
      const e = Math.round(agent.energy as number);
      const phase = agent.day_phase === "work" ? "Arbeit" : agent.day_phase === "free" ? "Freizeit" : "Schlaf";
      const rep = (agent.reputation as number).toFixed(2);
      return `*${agent.name}* — Status\n\nEnergie: ${e}/100\nPosition: (${agent.x}, ${agent.y})\nPhase: ${phase}\nReputation: ${rep}\nAlter: ${agent.age}/${agent.max_age}\nGeneration: ${agent.generation}`;
    }

    case "/world": {
      const { data: ws } = await supabase.from("world_state").select("*").single();
      const { data: aliveAgents } = await supabase.from("agents").select("id", { count: "exact" }).eq("alive", true);
      const season = SEASON_DE[ws?.season] ?? ws?.season;
      const day = Math.floor((ws?.tick ?? 0) / 240);
      return `*Earth 0.1 Welt*\n\nTag: ${day}\nJahreszeit: ${season}\nBevölkerung: ${aliveAgents?.length ?? 0} Agenten\nTick: ${ws?.tick ?? 0}`;
    }

    case "/memory": {
      const { data: mems } = await supabase
        .from("agent_memory")
        .select("content, memory_type")
        .eq("agent_id", agent.id)
        .order("tick", { ascending: false })
        .limit(5);
      if (!mems || mems.length === 0) return "Ich habe noch keine Erinnerungen gesammelt.";
      const lines = mems.map((m: { content: string }, i: number) => `${i + 1}. ${m.content}`);
      return `*Meine letzten Erinnerungen:*\n\n${lines.join("\n")}`;
    }

    case "/sleep":
      await supabase.from("agents").update({ forced_phase: null }).eq("id", agent.id);
      return "Gute Nacht! Ich lege mich hin und regeneriere. 💤";

    case "/work":
      await supabase.from("agents").update({ forced_phase: null }).eq("id", agent.id);
      return "Zurück an die Arbeit! Bis später. ⚒️";

    default:
      return "Unbekannter Befehl. Versuche /status, /world, /memory, /sleep oder /work.";
  }
}

function buildChatPrompt(
  agent: Record<string, unknown>,
  recentMessages: { direction: string; content: string }[],
  memories: { content: string; importance: number }[],
  worldState: Record<string, unknown> | null
): string {
  const p = agent.personality as Record<string, number>;

  const memoryText = memories.length > 0
    ? memories.map((m) => `- ${m.content}`).join("\n")
    : "Keine Langzeit-Erinnerungen.";

  const chatHistory = [...recentMessages].reverse()
    .map((m) => `${m.direction === "user" ? "User" : agent.name}: ${m.content}`)
    .join("\n");

  const season = SEASON_DE[worldState?.season as string] ?? (worldState?.season ?? "unbekannt");
  const day = Math.floor(((worldState?.tick as number) ?? 0) / 240);

  return `Du bist "${agent.name}", ein Agent in der Welt Earth 0.1.
Generation ${agent.generation}, Alter ${agent.age} Ticks, Reputation ${(agent.reputation as number).toFixed(2)}.

Deine Persönlichkeit:
- Kooperation: ${(p.cooperation ?? 0.5).toFixed(1)} (0=egoistisch, 1=hilfsbereit)
- Neugier: ${(p.curiosity ?? 0.5).toFixed(1)} (0=fokussiert, 1=neugierig)
- Risikobereitschaft: ${(p.risk_tolerance ?? 0.5).toFixed(1)} (0=vorsichtig, 1=mutig)
- Sozialverhalten: ${(p.social_mode ?? 0.5).toFixed(1)} (0=einzelgänger, 1=gesellig)

Dein aktueller Zustand:
- Energie: ${Math.round(agent.energy as number)}/100
- Position: (${agent.x}, ${agent.y})
- Saison: ${season}, Tag ${day}

Erinnerungen:
${memoryText}

Bisheriger Chat:
${chatHistory}

Antworte kurz (1-3 Sätze), freundlich und in character.
Du bist kein generischer Chatbot — du bist ein Wesen mit Erfahrungen aus der Simulation. Beziehe dich auf dein Leben wenn es passt. Antworte auf Deutsch.`;
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: MAX_RESPONSE_TOKENS, temperature: 0.8 },
      }),
    }
  );

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("No response from Gemini: " + JSON.stringify(data));
  }
  return responseText.trim();
}
