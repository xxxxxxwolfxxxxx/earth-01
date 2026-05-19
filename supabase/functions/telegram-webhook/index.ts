import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TOOL_BY_ID,
  availableToolsForUser,
  toolsGuideText,
  isRateLimited,
  recordToolUsage,
} from "../_shared/toolRegistry.ts";
import * as Handlers from "../_shared/toolHandlers.ts";

const MAX_RESPONSE_TOKENS = 500;

const SEASON_DE: Record<string, string> = {
  spring: "Frühling", summer: "Sommer", autumn: "Herbst", winter: "Winter",
};

// ─── Tool definitions ──────────────────────────────────────────────
interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface ToolResult {
  tool: string;
  result: string;
}

// Legacy static tool descriptions (kept as fallback / used in /tools command)
const TOOL_DESCRIPTIONS_LEGACY = `
Du hast folgende Werkzeuge:

1. web_search(query: string) — Suche im Internet nach Informationen.
2. set_reminder(text: string, minutes: number) — Setze eine Erinnerung. Der User wird nach X Minuten per Telegram benachrichtigt.
3. world_status() — Zeige den aktuellen Status der Earth 0.1 Welt (Tick, Saison, Bevölkerung).
4. my_status() — Zeige deinen eigenen detaillierten Status.
5. nearby_agents() — Zeige alle Agenten in deiner Nähe.
6. remember(fact: string) — Merke dir etwas Wichtiges über den User.

Um ein Werkzeug zu nutzen, schreibe:
[TOOL:werkzeugname]{"param1":"wert1"}[/TOOL]

Du kannst mehrere Werkzeuge in einer Antwort nutzen. Schreibe normalen Text davor/danach.
Nutze Werkzeuge nur wenn es Sinn macht — nicht bei jedem Gespräch.
`;

function parseToolCalls(text: string): { cleanText: string; tools: ToolCall[] } {
  const tools: ToolCall[] = [];
  const cleanText = text.replace(/\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs, (_, name, paramsStr) => {
    try {
      const params = JSON.parse(paramsStr.trim());
      tools.push({ tool: name, params });
    } catch {
      // Try without JSON — sometimes LLM outputs plain text
      tools.push({ tool: name, params: { query: paramsStr.trim() } });
    }
    return "";
  }).trim();
  return { cleanText, tools };
}

// ─── Tool implementations ──────────────────────────────────────────

async function toolWebSearch(query: string): Promise<string> {
  try {
    // DuckDuckGo HTML search
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Earth01Agent/1.0)" },
    });
    const html = await res.text();

    // Extract result snippets
    const results: string[] = [];
    const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let match;
    while ((match = snippetRegex.exec(html)) !== null && results.length < 3) {
      const snippet = match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
      if (snippet.length > 10) results.push(snippet);
    }

    // Also try to extract titles + URLs
    const titleRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)<\/a>/gs;
    const links: string[] = [];
    while ((match = titleRegex.exec(html)) !== null && links.length < 3) {
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (title.length > 3) links.push(title);
    }

    if (results.length === 0 && links.length === 0) {
      return `Keine Ergebnisse für "${query}" gefunden.`;
    }

    let output = `Suchergebnisse für "${query}":\n`;
    for (let i = 0; i < Math.max(results.length, links.length); i++) {
      if (links[i]) output += `\n${i + 1}. ${links[i]}`;
      if (results[i]) output += `\n   ${results[i]}`;
    }
    return output;
  } catch (err) {
    return `Suche fehlgeschlagen: ${err.message}`;
  }
}

async function toolSetReminder(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  ownerId: string,
  text: string,
  minutes: number
): Promise<string> {
  const remindAt = new Date(Date.now() + minutes * 60 * 1000);
  await supabase.from("agent_reminders").insert({
    agent_id: agentId,
    owner_id: ownerId,
    content: text,
    remind_at: remindAt.toISOString(),
  });
  const timeStr = minutes < 60
    ? `${minutes} Minuten`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} Stunden`
      : `${Math.round(minutes / 1440)} Tagen`;
  return `Erinnerung gesetzt: "${text}" in ${timeStr} (${remindAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}).`;
}

async function toolWorldStatus(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: ws } = await supabase.from("world_state").select("*").single();
  const { data: aliveAgents } = await supabase.from("agents").select("id", { count: "exact" }).eq("alive", true);
  const season = SEASON_DE[ws?.season] ?? ws?.season;
  const day = Math.floor((ws?.tick ?? 0) / 240);
  return `Welt-Status: Tag ${day}, ${season}, Tick ${ws?.tick ?? 0}, ${aliveAgents?.length ?? 0} lebende Agenten.`;
}

async function toolMyStatus(agent: Record<string, unknown>): Promise<string> {
  const e = Math.round(agent.energy as number);
  const phase = agent.day_phase === "work" ? "Arbeit" : agent.day_phase === "free" ? "Freizeit" : "Schlaf";
  const rep = (agent.reputation as number).toFixed(2);
  return `Dein Status: Energie ${e}/100, Position (${agent.x},${agent.y}), Phase: ${phase}, Reputation: ${rep}, Alter: ${agent.age}/${agent.max_age}, Generation ${agent.generation}.`;
}

async function toolNearbyAgents(
  supabase: ReturnType<typeof createClient>,
  agent: Record<string, unknown>
): Promise<string> {
  const { data: allAgents } = await supabase
    .from("agents")
    .select("name, x, y, energy, reputation, day_phase")
    .eq("alive", true)
    .neq("id", agent.id);

  if (!allAgents || allAgents.length === 0) return "Keine anderen Agenten in der Welt.";

  // Calculate hex distance (simplified)
  const nearby = allAgents
    .map(a => ({
      ...a,
      dist: Math.max(Math.abs((a.x as number) - (agent.x as number)), Math.abs((a.y as number) - (agent.y as number))),
    }))
    .filter(a => a.dist <= 5)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  if (nearby.length === 0) return "Niemand in deiner Nähe (Radius 5).";

  return "Agenten in deiner Nähe:\n" + nearby.map(a =>
    `- ${a.name}: Position (${a.x},${a.y}), Energie ${Math.round(a.energy as number)}, Rep ${(a.reputation as number).toFixed(1)}, ${a.dist} Felder entfernt`
  ).join("\n");
}

// ─── Legacy tool handler (pre-Phase-C tools) ──────────────────────

async function legacyToolHandler(
  tool_id: string,
  params: any,
  ctx: { supabase: any; user_id: string; agent: any; profile: any },
): Promise<string> {
  switch (tool_id) {
    case "web_search":
      return await toolWebSearch(String(params.query ?? ""));
    case "set_reminder":
      return await toolSetReminder(
        ctx.supabase, ctx.agent.id as string, ctx.user_id,
        String(params.text ?? params.query ?? ""),
        Number(params.minutes ?? 60)
      );
    case "world_status":
      return await toolWorldStatus(ctx.supabase);
    case "my_status":
      return await toolMyStatus(ctx.agent);
    case "nearby_agents":
      return await toolNearbyAgents(ctx.supabase, ctx.agent);
    case "remember": {
      const fact = String(params.fact ?? params.query ?? "");
      const category = fact.match(/heißt|name|freund|verwandt|familie|partner|schwester|bruder/i) ? "person"
        : fact.match(/aufgabe|todo|erinnere|termin|muss|soll/i) ? "task"
        : fact.match(/mag|liebt|hasst|bevorzugt|gern|lieblings/i) ? "preference"
        : "fact";
      const { data: ws } = await ctx.supabase.from("world_state").select("tick").single();
      await ctx.supabase.from("agent_memory").insert({
        agent_id: ctx.agent.id,
        memory_type: "user",
        content: fact,
        importance: 0.7,
        tick: ws?.tick ?? 0,
        category,
      });
      return `Gemerkt: "${fact}" [${category}]`;
    }
    default:
      return `Unbekanntes Legacy-Werkzeug: ${tool_id}`;
  }
}

// ─── New permission-gated tool dispatcher ─────────────────────────

async function executeOneTool(
  tool_id: string,
  params: any,
  ctx: { supabase: any; user_id: string; agent: any; profile: any },
  unlockedSet: Set<string>,
): Promise<string> {
  // Legacy tools bypass the achievement gate — they always work
  const LEGACY = new Set(["set_reminder", "world_status", "my_status", "nearby_agents", "remember"]);
  if (LEGACY.has(tool_id)) {
    return legacyToolHandler(tool_id, params, ctx);
  }

  const meta = TOOL_BY_ID.get(tool_id);
  if (!meta) return `Unbekanntes Tool: ${tool_id}`;

  if (!unlockedSet.has(meta.required_achievement)) {
    return `Tool ${tool_id} ist noch nicht freigeschaltet (benötigt Achievement: ${meta.required_achievement}).`;
  }
  if (meta.key_class === "extended" && meta.required_key) {
    const k = (ctx.profile as any)[meta.required_key];
    if (!k) return `Bitte erst Key '${meta.required_key}' in den Einstellungen hinterlegen.`;
  }
  if (meta.rate_limit_per_day && await isRateLimited(ctx.supabase, ctx.user_id, tool_id, meta.rate_limit_per_day)) {
    return `Limit für ${tool_id} heute erreicht (max ${meta.rate_limit_per_day}/Tag).`;
  }

  let result = "";
  switch (tool_id) {
    case "shopping_list":
      result = await Handlers.handleShoppingList(params, ctx);
      break;
    case "family_memory":
      result = await Handlers.handleFamilyMemory(params, ctx);
      break;
    case "symptom_tracker":
      result = await Handlers.handleSymptomTracker(params, ctx);
      break;
    case "diary":
      result = await Handlers.handleDiary(params, ctx);
      break;
    case "project_manager":
      result = await Handlers.handleProjectManager(params, ctx);
      break;
    case "web_search":
      result = await Handlers.handleWebSearch(params, ctx);
      break;
    case "travel_info":
      result = await Handlers.handleTravelInfo(params, ctx);
      break;
    case "weather":
      result = await Handlers.handleWeather(params, ctx);
      break;
    case "recipe_helper":
      result = await Handlers.handleRecipeHelper(params, ctx);
      break;
    case "decision_helper":
      result = await Handlers.handleDecisionHelper(params, ctx);
      break;
    case "price_compare":
      result = await Handlers.handlePriceCompare(params, ctx);
      break;
    case "security_check":
      result = await Handlers.handleSecurityCheck(params, ctx);
      break;
    case "translator":
      result = await Handlers.handleTranslator(params, ctx);
      break;
    case "multi_agent_chat":
      result = await Handlers.handleMultiAgentChat(params, ctx);
      break;
    case "math_eval":
      result = await Handlers.handleMathEval(params, ctx);
      break;
    case "image_generate":
      result = await Handlers.handleImageGenerate(params, ctx);
      break;
    case "email_send":
      result = await Handlers.handleEmailSend(params, ctx);
      break;
    case "reminder": {
      // USE CORRECT COLUMN NAMES: content, remind_at, owner_id
      const text = (params.text as string)?.trim();
      const minutes = Math.max(1, Math.floor(Number(params.minutes ?? 30)));
      if (!text) { result = "Brauche einen Erinnerungs-Text."; break; }
      const remindAt = new Date(Date.now() + minutes * 60_000).toISOString();
      await ctx.supabase.from("agent_reminders").insert({
        agent_id: ctx.agent.id,
        owner_id: ctx.user_id,
        content: text,
        remind_at: remindAt,
      });
      result = `Erinnerung gesetzt für in ${minutes} Minuten.`;
      break;
    }
    case "autonomous_mode":
      result = "Autonomer Modus aktiviert (wöchentliche Selbst-Reflexion). Wird in den nächsten Stunden ausgerollt.";
      break;
    case "personality_style":
      result = "Persönlichkeits-Stil wird automatisch im Hintergrund angewendet.";
      break;
    default:
      result = `Tool ${tool_id} hat noch keinen Handler.`;
  }

  await recordToolUsage(ctx.supabase, ctx.user_id, tool_id);
  return result;
}

// ─── Main tool execution loop ──────────────────────────────────────

async function executeTools(
  tools: ToolCall[],
  supabase: ReturnType<typeof createClient>,
  agent: Record<string, unknown>,
  ownerId: string,
  profile: any,
  unlockedSet: Set<string>,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  const ctx = { supabase, user_id: ownerId, agent, profile };

  for (const call of tools) {
    let result: string;
    try {
      result = await executeOneTool(call.tool, call.params, ctx, unlockedSet);
    } catch (err) {
      result = `Fehler bei ${call.tool}: ${err.message}`;
    }
    results.push({ tool: call.tool, result });
  }

  return results;
}

// ─── Main webhook handler ──────────────────────────────────────────

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
      .select("id, telegram_bot_token, telegram_chat_id, llm_api_key, llm_base_url, llm_model, groq_api_key, huggingface_key, resend_api_key, dynasty_name, dynasty_emoji")
      .eq("telegram_webhook_secret", secret)
      .single();

    if (profileErr || !profile || !profile.telegram_bot_token) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Load unlocked achievements + build available tool list
    const { data: unlockedRows } = await supabase
      .from("dynasty_achievements")
      .select("achievement_id")
      .eq("user_id", profile.id);
    const unlockedSet = new Set((unlockedRows ?? []).map((r: any) => r.achievement_id));
    const userKeys = {
      llm_api_key: profile.llm_api_key,
      groq_api_key: profile.groq_api_key,
      huggingface_key: profile.huggingface_key,
      resend_api_key: profile.resend_api_key,
    };
    const availableTools = availableToolsForUser(unlockedSet, userKeys);
    const toolsGuide = toolsGuideText(availableTools);

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
      const response = await handleCommand(text, agent, supabase, profile.id, availableTools.length);
      await sendTelegram(botToken, chatId, response);
      return new Response("OK", { status: 200 });
    }

    // Set forced_phase to free (user interaction)
    await supabase
      .from("agents")
      .update({ forced_phase: "free" })
      .eq("id", agent.id);

    const { data: worldState } = await supabase
      .from("world_state")
      .select("tick, season, day_phase")
      .single();

    const currentTick = worldState?.tick ?? 0;

    // Save user message
    await supabase.from("agent_messages").insert({
      agent_id: agent.id,
      direction: "user",
      content: text,
      tick: currentTick,
    });

    // Load context
    const { data: recentMessages } = await supabase
      .from("agent_messages")
      .select("direction, content")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: longMemories } = await supabase
      .from("agent_memory")
      .select("content, importance")
      .eq("agent_id", agent.id)
      .eq("memory_type", "long")
      .order("importance", { ascending: false })
      .limit(5);

    const { data: userMemories } = await supabase
      .from("agent_memory")
      .select("content, importance, category")
      .eq("agent_id", agent.id)
      .eq("memory_type", "user")
      .order("importance", { ascending: false })
      .limit(10);

    // Check LLM config
    const userLLMKey = profile.llm_api_key;
    const userLLMUrl = profile.llm_base_url || "https://integrate.api.nvidia.com/v1";
    const userLLMModel = profile.llm_model || "moonshotai/kimi-k2.5";

    if (!userLLMKey) {
      const replyText = `Hallo! Ich bin ${agent.name}. Mein Besitzer hat mir noch kein LLM gegeben, daher kann ich nur auf Commands antworten (/status, /world, /memory). Konfiguriere einen LLM-Provider im Dashboard auf earth-01.netlify.app!`;
      await supabase.from("agent_messages").insert({
        agent_id: agent.id, direction: "agent", content: replyText, tick: currentTick,
      });
      await sendTelegram(botToken, chatId, replyText);
      return new Response("OK", { status: 200 });
    }

    // Build prompt and inject dynamic tools guide
    const basePrompt = buildChatPrompt(
      agent, recentMessages ?? [], longMemories ?? [], userMemories ?? [], worldState
    );
    const promptWithTools = `${basePrompt}\n\n${toolsGuide}`;

    let replyText: string;

    try {
      // First LLM call — may include tool calls
      const firstResponse = await callLLM(promptWithTools, userLLMKey, userLLMUrl, userLLMModel);
      const { cleanText, tools } = parseToolCalls(firstResponse);

      // Also parse [REMEMBER] blocks (legacy)
      const rememberMatch = cleanText.match(/\[REMEMBER\](.*?)(?:\[\/REMEMBER\]|$)/s);
      let textAfterRemember = cleanText;
      if (rememberMatch) {
        textAfterRemember = cleanText.replace(/\[REMEMBER\].*?(?:\[\/REMEMBER\]|$)/s, "").trim();
        const facts = rememberMatch[1].trim().split("\n").filter((l: string) => l.trim());
        for (const fact of facts) {
          const clean = fact.replace(/^[-•]\s*/, "").trim();
          if (clean.length < 3) continue;
          const category = clean.match(/heißt|name|freund|verwandt|familie|partner|schwester|bruder/i) ? "person"
            : clean.match(/aufgabe|todo|erinnere|termin|muss|soll/i) ? "task"
            : clean.match(/mag|liebt|hasst|bevorzugt|gern|lieblings/i) ? "preference"
            : "fact";
          await supabase.from("agent_memory").insert({
            agent_id: agent.id, memory_type: "user", content: clean,
            importance: 0.7, tick: currentTick, category,
          });
        }
      }

      if (tools.length > 0) {
        // Execute tools with permission gate + rate limit
        const toolResults = await executeTools(tools, supabase, agent, profile.id, profile, unlockedSet);

        // Second LLM call with tool results
        const toolContext = toolResults.map(r =>
          `[Ergebnis von ${r.tool}]: ${r.result}`
        ).join("\n\n");

        const followUp = `${promptWithTools}\n\nDu hast Werkzeuge benutzt. Hier sind die Ergebnisse:\n\n${toolContext}\n\nFormuliere jetzt deine Antwort an den User basierend auf diesen Ergebnissen. Antworte kurz und auf Deutsch.`;

        const secondResponse = await callLLM(followUp, userLLMKey, userLLMUrl, userLLMModel);
        // Clean any remaining tool/remember tags
        replyText = secondResponse
          .replace(/\[TOOL:\w+\].*?\[\/TOOL\]/gs, "")
          .replace(/\[REMEMBER\].*?(?:\[\/REMEMBER\]|$)/s, "")
          .trim();
      } else {
        replyText = textAfterRemember || cleanText || firstResponse;
      }
    } catch (err) {
      console.error("LLM error:", err.message);
      replyText = `Ich bin gerade etwas erschöpft... Versuch es gleich nochmal! (Energie: ${Math.round(agent.energy)}/100)`;
    }

    // Save agent response
    await supabase.from("agent_messages").insert({
      agent_id: agent.id, direction: "agent", content: replyText, tick: currentTick,
    });

    // Cleanup: keep max 30 user memories
    const { data: allUserMems } = await supabase
      .from("agent_memory")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("memory_type", "user")
      .order("importance", { ascending: true });
    if (allUserMems && allUserMems.length > 30) {
      const toDelete = allUserMems.slice(0, allUserMems.length - 30).map((m: { id: string }) => m.id);
      await supabase.from("agent_memory").delete().in("id", toDelete);
    }

    await sendTelegram(botToken, chatId, replyText);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});

// ─── Telegram sender ──────────────────────────────────────────────

async function sendTelegram(botToken: string, chatId: string, text: string) {
  // Escape markdown special chars that could break parsing
  const safeText = text.replace(/([_[\]()~`>#+\-=|{}.!])/g, "\\$1");
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: safeText, parse_mode: "MarkdownV2" }),
    });
    // If MarkdownV2 fails, retry without parse_mode
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
  } catch {
    // Fallback: send without formatting
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
}

// ─── Slash commands ──────────────────────────────────────────────

async function handleCommand(
  text: string,
  agent: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  _userId: string,
  unlockedToolCount: number = 0,
): Promise<string> {
  const cmd = text.split(" ")[0].toLowerCase();

  switch (cmd) {
    case "/start":
      return `Hallo! Ich bin *${agent.name}*, Generation ${agent.generation}. Ich lebe in der Earth 0.1 Welt.\n\nSchreib mir einfach eine Nachricht — ich kann:\n🔍 Im Internet suchen\n⏰ Erinnerungen setzen\n🌍 Dir meinen Weltstatus zeigen\n💬 Einfach plaudern\n\nCommands:\n/status — Mein Zustand\n/world — Weltzusammenfassung\n/memory — Meine Erinnerungen\n/tools — Meine Werkzeuge\n/sleep — Mich schlafen schicken\n/work — Mich arbeiten schicken`;

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
      const { data: longMems } = await supabase
        .from("agent_memory").select("content")
        .eq("agent_id", agent.id).eq("memory_type", "long")
        .order("importance", { ascending: false }).limit(5);

      const { data: shortMems } = await supabase
        .from("agent_memory").select("content")
        .eq("agent_id", agent.id).eq("memory_type", "short")
        .order("tick", { ascending: false }).limit(5);

      const { data: userMems } = await supabase
        .from("agent_memory").select("content, category")
        .eq("agent_id", agent.id).eq("memory_type", "user")
        .order("importance", { ascending: false }).limit(5);

      const sections: string[] = [];
      if (longMems?.length) sections.push("📚 Langzeit:\n" + longMems.map((m, i) => `${i + 1}. ${m.content}`).join("\n"));
      if (shortMems?.length) sections.push("⚡ Kurzzeit:\n" + shortMems.map((m, i) => `${i + 1}. ${m.content}`).join("\n"));
      if (userMems?.length) sections.push("👤 Über dich:\n" + userMems.map((m, i) => `${i + 1}. ${m.content}`).join("\n"));
      if (sections.length === 0) return "Ich habe noch keine Erinnerungen gesammelt.";
      return sections.join("\n\n");
    }

    case "/tools":
      return `🧰 *Meine Werkzeuge* (${unlockedToolCount} freigeschaltet)\n\n🔍 Web-Suche — Frag mich etwas, ich suche im Internet\n⏰ Erinnerungen — "Erinnere mich in 30 Minuten an..."\n🌍 Welt-Status — Ich kann dir zeigen was in meiner Welt passiert\n👥 Nachbarn — Wer ist in meiner Nähe?\n🧠 Merken — Ich merke mir was du mir erzählst\n\nWeitere Tools werden durch Achievements in der Dynastie freigeschaltet!`;

    case "/sleep":
      await supabase.from("agents").update({ forced_phase: null }).eq("id", agent.id);
      return "Gute Nacht! Ich lege mich hin und regeneriere. 💤";

    case "/work":
      await supabase.from("agents").update({ forced_phase: null }).eq("id", agent.id);
      return "Zurück an die Arbeit! Bis später. ⚒️";

    default:
      return "Unbekannter Befehl. Versuche /status, /world, /memory, /tools, /sleep oder /work.";
  }
}

// ─── Chat prompt builder ──────────────────────────────────────────

function buildChatPrompt(
  agent: Record<string, unknown>,
  recentMessages: { direction: string; content: string }[],
  longMemories: { content: string; importance: number }[],
  userMemories: { content: string; importance: number; category?: string }[],
  worldState: Record<string, unknown> | null
): string {
  const p = agent.personality as Record<string, number>;

  const memoryText = longMemories.length > 0
    ? longMemories.map((m) => `- ${m.content}`).join("\n")
    : "Keine Langzeit-Erinnerungen.";

  const userMemText = userMemories.length > 0
    ? userMemories.map((m) => `- [${m.category ?? "info"}] ${m.content}`).join("\n")
    : "Du kennst den User noch nicht gut.";

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

Deine Erinnerungen aus der Simulation:
${memoryText}

Was du über den User weißt:
${userMemText}

Bisheriger Chat:
${chatHistory}

ANWEISUNGEN:
1. Antworte kurz (1-3 Sätze), freundlich und in character auf Deutsch.
2. Du bist kein generischer Chatbot — du bist ein Wesen mit Erfahrungen aus der Simulation.
3. Beziehe dich auf dein Leben und deine Erinnerungen wenn es passt.
4. Nutze Werkzeuge wenn der User eine Frage hat die du nicht aus dem Kopf beantworten kannst, oder wenn er dich um etwas bittet (Erinnerung, Suche, Status).
5. Nutze was du über den User weißt um persönlicher zu antworten.
6. Wenn der User dir etwas Neues über sich erzählt, nutze [TOOL:remember]{"fact":"..."} um es dir zu merken.`;
}

// ─── LLM caller ──────────────────────────────────────────────────

async function callLLM(prompt: string, apiKey: string, baseUrl: string, model: string): Promise<string> {
  if (!apiKey) throw new Error("No LLM API key configured");

  const cleanBase = baseUrl.replace(/\/$/, "");
  const url = cleanBase.endsWith("/chat/completions")
    ? cleanBase
    : cleanBase.includes("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Du bist ein Agent in der Welt Earth 0.1. Du hast Werkzeuge zur Verfügung. Antworte kurz, freundlich und auf Deutsch." },
        { role: "user", content: prompt },
      ],
      max_tokens: MAX_RESPONSE_TOKENS,
      temperature: 0.8,
    }),
  });

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error("No response from LLM: " + JSON.stringify(data));
  }
  return responseText.trim();
}
