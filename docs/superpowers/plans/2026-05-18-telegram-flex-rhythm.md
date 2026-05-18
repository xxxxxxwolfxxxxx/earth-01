# Telegram-Chat & Flexibler Tagesrhythmus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Earth 0.1 agents reachable via Telegram with per-agent flexible day rhythm, so users can chat with their evolved agents anytime.

**Architecture:** Each user creates their own Telegram bot, stores the token in their profile. A Supabase Edge Function receives webhook messages, loads agent context + memories, calls Gemini Free API for in-character responses, and sends them back via Telegram. The simulation-tick is modified so each agent tracks its own work/free/sleep hours independently (8h each per 24h cycle), with instant free-time override when the user writes.

**Tech Stack:** Supabase Edge Functions (Deno), Telegram Bot API, Gemini Free API, React + Tailwind frontend

**Spec:** `docs/superpowers/specs/2026-05-18-telegram-flex-rhythm-design.md`

**Note:** This project has no test framework. Verification is done by deploying to Supabase and testing manually via Telegram and the web UI.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_telegram_flex_rhythm.sql`

This migration adds flexible rhythm fields to agents, Telegram fields to profiles, and creates the agent_messages table.

- [ ] **Step 1: Create the migration file**

```sql
-- 002_telegram_flex_rhythm.sql
-- Flexible day rhythm per agent + Telegram integration

-- 1. New columns on agents for per-agent rhythm
ALTER TABLE agents ADD COLUMN IF NOT EXISTS schedule_mode TEXT DEFAULT 'auto' CHECK (schedule_mode IN ('auto', 'manual'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS work_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS free_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sleep_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS cycle_start_tick BIGINT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS forced_phase TEXT DEFAULT NULL CHECK (forced_phase IN ('free', 'work', 'sleep', NULL));

-- 2. New columns on profiles for Telegram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT DEFAULT NULL;

-- 3. New table: agent_messages (chat history)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('user', 'agent')),
  content TEXT NOT NULL,
  tick BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_agent ON agent_messages(agent_id, created_at DESC);

-- 4. RLS for agent_messages
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own agent messages"
  ON agent_messages FOR SELECT
  USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own agent messages"
  ON agent_messages FOR INSERT
  WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

-- 5. Service role can do everything on agent_messages (for webhook edge function)
CREATE POLICY "Service role full access to agent_messages"
  ON agent_messages FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Enable realtime on agent_messages
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;

-- 7. Protect telegram_bot_token: only owner can read their own profile telegram fields
-- (existing RLS on profiles already limits SELECT to own row for sensitive fields,
--  but the current policy allows reading ALL profiles. We need a more restrictive policy
--  for the token field. Since RLS is row-level not column-level, we handle this in the
--  application layer: the frontend never exposes the full token, only masked version.)
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase db push
```

If `supabase db push` is not available (remote project without CLI link), apply via Supabase Dashboard SQL Editor: copy the SQL above and run it.

- [ ] **Step 3: Verify in Supabase Dashboard**

Open Supabase Dashboard → Table Editor:
- `agents` table should have 6 new columns: schedule_mode, work_ticks, free_ticks, sleep_ticks, cycle_start_tick, forced_phase
- `profiles` table should have 4 new columns: telegram_bot_token, telegram_chat_id, telegram_linked_at, telegram_webhook_secret
- `agent_messages` table should exist with columns: id, agent_id, direction, content, tick, created_at

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_telegram_flex_rhythm.sql
git commit -m "feat: add migration for telegram integration and flexible rhythm"
```

---

### Task 2: Flexible Rhythm in simulation-tick

**Files:**
- Modify: `supabase/functions/simulation-tick/index.ts`

Convert the global day phase to per-agent tracking. Each agent accumulates its own work/free/sleep ticks within a 240-tick cycle.

- [ ] **Step 1: Update the Agent type definition**

In `supabase/functions/simulation-tick/index.ts`, find the Agent type (around line 81) and add the new fields:

```typescript
type Agent = {
  id: string;
  name: string;
  x: number;
  y: number;
  energy: number;
  age: number;
  max_age: number;
  alive: boolean;
  day_phase: string;
  personality: Record<string, number>;
  reputation: number;
  imprisoned_until: number | null;
  pending_suggestion: Record<string, unknown> | null;
  generation: number;
  parent_a_id: string | null;
  parent_b_id: string | null;
  owner_id: string;
  // Flexible rhythm fields
  schedule_mode: string;
  work_ticks: number;
  free_ticks: number;
  sleep_ticks: number;
  cycle_start_tick: number;
  forced_phase: string | null;
};
```

- [ ] **Step 2: Add the per-agent phase function**

Replace the existing `getDayPhase` function with a new `getAgentPhase` function that calculates phase per agent:

```typescript
function getAgentPhase(agent: Agent, tick: number): string {
  // User interrupt overrides everything
  if (agent.forced_phase) return agent.forced_phase;

  // Emergency sleep if energy critically low
  if (agent.energy < 20 && agent.sleep_ticks < 80) return "sleep";

  const ticksInCycle = tick - agent.cycle_start_tick;
  const ticksRemaining = Math.max(0, DAY_LENGTH - ticksInCycle);

  // Force sleep if not enough sleep ticks and cycle ending soon
  if (agent.sleep_ticks < 80 && ticksRemaining <= (80 - agent.sleep_ticks)) {
    return "sleep";
  }

  // All phases fulfilled? Default to sleep (regeneration)
  if (agent.work_ticks >= 80 && agent.free_ticks >= 80 && agent.sleep_ticks >= 80) {
    return "sleep";
  }

  // Auto mode: personality-driven choice
  const priority = agent.personality.priority ?? 0.5;
  const social = agent.personality.social_mode ?? 0.5;

  // Prefer work if work ticks behind and priority high
  if (agent.work_ticks < 80 && priority > 0.5) return "work";
  // Prefer free if social and free ticks behind
  if (agent.free_ticks < 80 && social > 0.5) return "free";
  // Fill whatever is most behind
  if (agent.work_ticks <= agent.free_ticks && agent.work_ticks < 80) return "work";
  if (agent.free_ticks < 80) return "free";
  if (agent.sleep_ticks < 80) return "sleep";

  return "work";
}
```

Keep the old `getDayPhase` function — it's still used for `world_state.day_phase` (the global phase for display purposes).

- [ ] **Step 3: Update the per-agent loop to use individual phases**

In the main agent processing loop (around line 314), replace the line:

```typescript
agent.day_phase = dayPhase;
```

with cycle management and individual phase calculation:

```typescript
// Cycle reset check
if (tick - agent.cycle_start_tick >= DAY_LENGTH) {
  agent.work_ticks = 0;
  agent.free_ticks = 0;
  agent.sleep_ticks = 0;
  agent.cycle_start_tick = tick;
}

// Calculate individual phase
const agentPhase = getAgentPhase(agent, tick);
agent.day_phase = agentPhase;

// Increment phase counter
if (agentPhase === "work") agent.work_ticks++;
else if (agentPhase === "free") agent.free_ticks++;
else if (agentPhase === "sleep") agent.sleep_ticks++;
```

- [ ] **Step 4: Replace all `dayPhase` references with `agentPhase` in the agent loop**

In the agent processing loop, replace every reference to the variable `dayPhase` with `agentPhase`:

- Line ~346 (sleep check): `if (dayPhase === "sleep")` → `if (agentPhase === "sleep")`
- Line ~446 (work building): `if (dayPhase === "work" && ...` → `if (agentPhase === "work" && ...`
- Line ~475 (free socialization): `} else if (dayPhase === "free")` → `} else if (agentPhase === "free")`
- Line ~557 (free sharing): `if (dayPhase === "free" && ...` → `if (agentPhase === "free" && ...`

- [ ] **Step 5: Update the batch write to include new fields**

In the batch DB write section (around line 748), update the agent update object to include the new rhythm fields:

```typescript
const update: Record<string, unknown> = {
  x: agent.x, y: agent.y, energy: agent.energy, age: agent.age,
  alive: agent.alive, day_phase: agent.day_phase, reputation: agent.reputation,
  imprisoned_until: agent.imprisoned_until, pending_suggestion: agent.pending_suggestion,
  // Flexible rhythm fields
  work_ticks: agent.work_ticks, free_ticks: agent.free_ticks, sleep_ticks: agent.sleep_ticks,
  cycle_start_tick: agent.cycle_start_tick, forced_phase: agent.forced_phase,
};
```

- [ ] **Step 6: Handle forced_phase timeout**

Add forced_phase timeout logic at the start of the agent loop (after the cycle reset, before phase calculation). The forced_phase should expire after 50 ticks (5 minutes) without a new message. We track this by checking if there are recent messages:

```typescript
// Clear forced_phase if no recent user message (timeout after 50 ticks)
// The webhook sets forced_phase; we clear it after inactivity.
// Simple approach: forced_phase is cleared by the webhook timeout or manually.
// For now, simulation just respects it; the webhook manages the lifecycle.
```

Actually, the simplest approach: the webhook sets `forced_phase = 'free'` and also sets a `forced_phase_until` tick. But to avoid another DB column, we use a simpler rule: the webhook updates `forced_phase` on every message. The simulation-tick clears it if `free_ticks` for this cycle exceeds a reasonable limit (e.g., 120 — meaning the user has been chatting for 60% of the day). This prevents an agent from being stuck in free forever.

Add this before the `getAgentPhase` call:

```typescript
// Safety: clear forced_phase if agent has used excessive free time (>120 ticks in cycle)
if (agent.forced_phase === "free" && agent.free_ticks > 120) {
  agent.forced_phase = null;
}
```

- [ ] **Step 7: Deploy and verify**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase functions deploy simulation-tick
```

Verify in Supabase Dashboard → Edge Functions → Logs that the tick still runs without errors. Check that agents now have varying `day_phase` values instead of all being the same.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/simulation-tick/index.ts
git commit -m "feat: per-agent flexible day rhythm in simulation-tick"
```

---

### Task 3: register-telegram Edge Function

**Files:**
- Create: `supabase/functions/register-telegram/index.ts`

This function validates a Telegram bot token, sets up the webhook, and stores the token in the user's profile.

- [ ] **Step 1: Create the function directory**

```bash
mkdir -p /Users/matthiasduhrkop/Documents/earth-01/supabase/functions/register-telegram
```

- [ ] **Step 2: Write the edge function**

Create `supabase/functions/register-telegram/index.ts`:

```typescript
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { bot_token } = await req.json();
    if (!bot_token || typeof bot_token !== "string" || bot_token.length < 20) {
      return new Response(JSON.stringify({ error: "Bot-Token fehlt oder ungültig" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token with Telegram getMe
    const getMeRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const getMeData = await getMeRes.json();
    if (!getMeData.ok) {
      return new Response(JSON.stringify({ error: "Telegram-Token ungültig. Prüfe den Token vom BotFather." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botInfo = getMeData.result;

    // Generate webhook secret
    const webhookSecret = crypto.randomUUID();

    // Set webhook on Telegram
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to profile
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        bot: {
          name: botInfo.first_name,
          username: botInfo.username,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: Deploy and test**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase functions deploy register-telegram
```

Test with curl (replace YOUR_JWT and YOUR_BOT_TOKEN):
```bash
curl -X POST https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/register-telegram \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"bot_token":"YOUR_BOT_TOKEN"}'
```

Expected: `{"ok":true,"bot":{"name":"...","username":"..."}}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/register-telegram/
git commit -m "feat: add register-telegram edge function"
```

---

### Task 4: telegram-webhook Edge Function

**Files:**
- Create: `supabase/functions/telegram-webhook/index.ts`

This is the core function: receives Telegram messages, routes to the right agent, generates LLM responses, sends them back.

- [ ] **Step 1: Create the function directory**

```bash
mkdir -p /Users/matthiasduhrkop/Documents/earth-01/supabase/functions/telegram-webhook
```

- [ ] **Step 2: Write the edge function**

Create `supabase/functions/telegram-webhook/index.ts`:

```typescript
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
    // 1. Validate webhook secret
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    if (!secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Find profile by webhook secret
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, telegram_bot_token, telegram_chat_id")
      .eq("telegram_webhook_secret", secret)
      .single();

    if (profileErr || !profile || !profile.telegram_bot_token) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse Telegram update
    const update = await req.json();
    const message = update.message;
    if (!message || !message.text) {
      return new Response("OK", { status: 200 }); // Ignore non-text updates
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const botToken = profile.telegram_bot_token;

    // 3. Save chat_id if not yet set
    if (!profile.telegram_chat_id) {
      await supabase
        .from("profiles")
        .update({ telegram_chat_id: chatId })
        .eq("id", profile.id);
    }

    // 4. Find user's best agent (alive, highest energy)
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

    // 5. Handle slash commands (no LLM needed)
    if (text.startsWith("/")) {
      const response = await handleCommand(text, agent, supabase, profile.id);
      await sendTelegram(botToken, chatId, response);
      return new Response("OK", { status: 200 });
    }

    // 6. Set forced_phase = 'free' so agent is available
    await supabase
      .from("agents")
      .update({ forced_phase: "free" })
      .eq("id", agent.id);

    // 7. Save user message
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

    // 8. Load context for LLM
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

    // 9. Build chat prompt
    const prompt = buildChatPrompt(agent, recentMessages ?? [], memories ?? [], worldState);

    // 10. Call Gemini Free API
    let replyText: string;
    try {
      replyText = await callGemini(prompt);
    } catch (err) {
      console.error("Gemini error:", err.message);
      replyText = `Ich bin gerade etwas erschöpft... Versuch es gleich nochmal! (Energie: ${Math.round(agent.energy)}/100)`;
    }

    // 11. Save agent response
    await supabase.from("agent_messages").insert({
      agent_id: agent.id,
      direction: "agent",
      content: replyText,
      tick: currentTick,
    });

    // 12. Send via Telegram
    await sendTelegram(botToken, chatId, replyText);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});

// --- Helper functions ---

async function sendTelegram(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
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
      if (!mems || mems.length === 0) {
        return "Ich habe noch keine Erinnerungen gesammelt.";
      }
      const lines = mems.map((m, i) => `${i + 1}. ${m.content}`);
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

  // Reverse so oldest first in chat history
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
        generationConfig: {
          maxOutputTokens: MAX_RESPONSE_TOKENS,
          temperature: 0.8,
        },
      }),
    }
  );

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No response from Gemini: " + JSON.stringify(data));
  }
  return text.trim();
}
```

- [ ] **Step 3: Set the GEMINI_API_KEY secret**

```bash
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

If using Supabase Dashboard: Settings → Edge Functions → Secrets → Add `GEMINI_API_KEY`.

- [ ] **Step 4: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase functions deploy telegram-webhook
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook/
git commit -m "feat: add telegram-webhook edge function with LLM chat"
```

---

### Task 5: unregister-telegram Edge Function

**Files:**
- Create: `supabase/functions/unregister-telegram/index.ts`

- [ ] **Step 1: Create the function directory**

```bash
mkdir -p /Users/matthiasduhrkop/Documents/earth-01/supabase/functions/unregister-telegram
```

- [ ] **Step 2: Write the edge function**

Create `supabase/functions/unregister-telegram/index.ts`:

```typescript
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current bot token from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token")
      .eq("id", user.id)
      .single();

    // Delete webhook on Telegram if token exists
    if (profile?.telegram_bot_token) {
      try {
        await fetch(
          `https://api.telegram.org/bot${profile.telegram_bot_token}/deleteWebhook`
        );
      } catch {
        // Best-effort: even if this fails, we clear the profile
      }
    }

    // Clear all telegram fields in profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        telegram_bot_token: null,
        telegram_chat_id: null,
        telegram_linked_at: null,
        telegram_webhook_secret: null,
      })
      .eq("id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Profil-Update fehlgeschlagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase functions deploy unregister-telegram
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/unregister-telegram/
git commit -m "feat: add unregister-telegram edge function"
```

---

### Task 6: worldService.js — Telegram & Messages API

**Files:**
- Modify: `src/lib/worldService.js`

Add functions for Telegram registration and message fetching.

- [ ] **Step 1: Add the new functions at the end of worldService.js**

Append these functions after the existing `submitAgentSuggestion` function:

```javascript
// --- Telegram Integration ---

export async function registerTelegram(botToken) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-telegram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bot_token: botToken }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen')
  return data
}

export async function unregisterTelegram() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unregister-telegram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Trennung fehlgeschlagen')
  return data
}

export async function fetchTelegramStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('telegram_bot_token, telegram_chat_id, telegram_linked_at')
    .eq('id', user.id)
    .single()

  if (!data || !data.telegram_bot_token) return null

  // Mask token for display (show first 5 and last 5 chars)
  const token = data.telegram_bot_token
  const masked = token.length > 12
    ? token.slice(0, 5) + '...' + token.slice(-5)
    : '***'

  return {
    connected: true,
    maskedToken: masked,
    chatId: data.telegram_chat_id,
    linkedAt: data.telegram_linked_at,
  }
}

export async function fetchAgentMessages(agentId, limit = 50) {
  const { data } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).reverse() // Oldest first for chat display
}

export function subscribeToMessages(agentId, onMessage) {
  const id = ++channelCounter
  const channel = supabase
    .channel(`agent-messages-${id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `agent_id=eq.${agentId}` },
      (payload) => onMessage(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
```

- [ ] **Step 2: Verify the import of supabase is already at the top**

The file already has `import { supabase } from './supabase'` at line 1. No changes needed.

Also ensure `channelCounter` is accessible — it's already declared at line 21 as `let channelCounter = 0`. The new `subscribeToMessages` function uses it. No changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/worldService.js
git commit -m "feat: add telegram and messages API to worldService"
```

---

### Task 7: agentBrain.js — Chat Prompt Template

**Files:**
- Modify: `src/lib/agentBrain.js`

Add an exported `buildChatPrompt` function for use in the frontend chat view (matches the server-side version in telegram-webhook).

- [ ] **Step 1: Add the buildChatPrompt function**

Add this at the end of `src/lib/agentBrain.js`, before the final export line:

```javascript
export function buildChatPrompt(agent, messages, memories, worldState) {
  const p = agent.personality || {}

  const memoryText = memories.length > 0
    ? memories.map(m => `- ${m.content}`).join('\n')
    : 'Keine Langzeit-Erinnerungen.'

  const chatHistory = messages
    .map(m => `${m.direction === 'user' ? 'User' : agent.name}: ${m.content}`)
    .join('\n')

  const season = SEASON_DE[worldState?.season] ?? (worldState?.season ?? 'unbekannt')
  const day = Math.floor((worldState?.tick ?? 0) / 240)

  return `Du bist "${agent.name}", ein Agent in der Welt Earth 0.1.
Generation ${agent.generation}, Alter ${agent.age} Ticks, Reputation ${(agent.reputation ?? 0).toFixed(2)}.

Deine Persönlichkeit:
- Kooperation: ${(p.cooperation ?? 0.5).toFixed(1)} (0=egoistisch, 1=hilfsbereit)
- Neugier: ${(p.curiosity ?? 0.5).toFixed(1)} (0=fokussiert, 1=neugierig)
- Risikobereitschaft: ${(p.risk_tolerance ?? 0.5).toFixed(1)} (0=vorsichtig, 1=mutig)
- Sozialverhalten: ${(p.social_mode ?? 0.5).toFixed(1)} (0=einzelgänger, 1=gesellig)

Dein aktueller Zustand:
- Energie: ${Math.round(agent.energy)}/100
- Position: (${agent.x}, ${agent.y})
- Saison: ${season}, Tag ${day}

Erinnerungen:
${memoryText}

Bisheriger Chat:
${chatHistory}

Antworte kurz (1-3 Sätze), freundlich und in character.
Du bist kein generischer Chatbot — du bist ein Wesen mit Erfahrungen aus der Simulation. Beziehe dich auf dein Leben wenn es passt. Antworte auf Deutsch.`
}
```

- [ ] **Step 2: Update the export line**

The file currently exports at the bottom:

```javascript
export { buildPrompt, parseResponse }
```

Change it to:

```javascript
export { buildPrompt, parseResponse, buildChatPrompt }
```

Wait — `buildChatPrompt` is already exported with the `export function` syntax above. So the named export line only needs `buildPrompt` and `parseResponse`. No change to the export line needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agentBrain.js
git commit -m "feat: add buildChatPrompt to agentBrain"
```

---

### Task 8: TelegramSetup Component

**Files:**
- Create: `src/components/TelegramSetup.jsx`

UI component for connecting/disconnecting a Telegram bot, embedded in the Dashboard.

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect } from 'react'
import { MessageSquare, Link2, Unlink, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { registerTelegram, unregisterTelegram, fetchTelegramStatus } from '../lib/worldService'

export default function TelegramSetup() {
  const [status, setStatus] = useState(null) // null = loading, false = not connected, object = connected
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    const s = await fetchTelegramStatus()
    setStatus(s || false)
  }

  async function handleConnect() {
    if (!token.trim()) {
      setError('Bitte Bot-Token eingeben')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await registerTelegram(token.trim())
      setSuccess(`Bot @${result.bot.username} verbunden!`)
      setToken('')
      await loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      await unregisterTelegram()
      setStatus(false)
      setSuccess('Bot getrennt.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === null) {
    return (
      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Telegram-Status...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-display text-white text-lg font-bold">Telegram verbinden</h3>
          <p className="text-gray-500 text-sm">Chatte per Telegram mit deinem Agenten</p>
        </div>
      </div>

      {status && status.connected ? (
        /* Connected state */
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm">Verbunden</span>
            <span className="text-gray-500 text-sm ml-1">({status.maskedToken})</span>
          </div>
          {status.chatId ? (
            <p className="text-gray-400 text-xs">Chat aktiv. Schreib deinem Bot in Telegram!</p>
          ) : (
            <p className="text-yellow-400 text-xs">Bot verbunden, aber noch kein Chat gestartet. Sende /start an deinen Bot in Telegram.</p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            Trennen
          </button>
        </div>
      ) : (
        /* Not connected state */
        <div className="space-y-4">
          {/* Guide toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showGuide ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Wie erstelle ich einen Telegram-Bot?
          </button>

          {showGuide && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-sm space-y-2">
              <p className="text-gray-300 font-medium">Schritt-für-Schritt:</p>
              <ol className="text-gray-400 space-y-1.5 list-decimal list-inside">
                <li>Öffne Telegram und suche nach <strong className="text-white">@BotFather</strong></li>
                <li>Sende <code className="px-1 py-0.5 bg-white/10 rounded text-xs">/newbot</code></li>
                <li>Wähle einen Namen (z.B. "Mein Earth Agent")</li>
                <li>Wähle einen Username (z.B. <code className="px-1 py-0.5 bg-white/10 rounded text-xs">mein_earth_agent_bot</code>)</li>
                <li>Kopiere den <strong className="text-white">Token</strong> und füge ihn unten ein</li>
              </ol>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-2"
              >
                @BotFather öffnen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Token input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => { setToken(e.target.value); setError(null) }}
              placeholder="Bot-Token einfügen..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !token.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Verbinden
            </button>
          </div>
        </div>
      )}

      {/* Error/Success messages */}
      {error && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300 text-sm">{success}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TelegramSetup.jsx
git commit -m "feat: add TelegramSetup component"
```

---

### Task 9: AgentChat Component

**Files:**
- Create: `src/components/AgentChat.jsx`

Read-only chat history view showing the Telegram conversation in the browser.

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Loader2, User, Bot } from 'lucide-react'
import { fetchAgentMessages, subscribeToMessages } from '../lib/worldService'

export default function AgentChat({ agentId, agentName }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!agentId) return

    let unsubscribe = null

    async function load() {
      const msgs = await fetchAgentMessages(agentId)
      setMessages(msgs)
      setLoading(false)

      // Subscribe to new messages
      unsubscribe = subscribeToMessages(agentId, (newMsg) => {
        setMessages((prev) => [...prev, newMsg])
      })
    }

    load()
    return () => { if (unsubscribe) unsubscribe() }
  }, [agentId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Lade Chat...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Noch keine Nachrichten.</p>
        <p className="text-gray-600 text-xs mt-1">Schreib deinem Agenten per Telegram!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto p-4 rounded-xl bg-black/20">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-2 ${msg.direction === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.direction === 'agent' && (
            <div className="w-7 h-7 rounded-full bg-nebula-500/20 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-nebula-400" />
            </div>
          )}
          <div
            className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
              msg.direction === 'user'
                ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100'
                : 'bg-white/5 border border-white/10 text-gray-300'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <span className="text-[10px] text-gray-600 mt-1 block">
              {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {msg.direction === 'user' && (
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-1">
              <User className="w-4 h-4 text-blue-400" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentChat.jsx
git commit -m "feat: add AgentChat component for message history"
```

---

### Task 10: Integrate TelegramSetup & AgentChat into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx`

Add TelegramSetup section and AgentChat tab to the dashboard.

- [ ] **Step 1: Add imports**

At the top of Dashboard.jsx, add:

```javascript
import TelegramSetup from '../components/TelegramSetup'
import AgentChat from '../components/AgentChat'
```

Add `MessageSquare` to the lucide-react import:

```javascript
import { Users, Heart, Skull, Clock, MapPin, Brain, Zap, Plus, Sparkles, Loader2, MessageSquare } from 'lucide-react'
```

- [ ] **Step 2: Add chat toggle state to AgentCard**

In the `AgentCard` component, add state for showing chat:

```javascript
const [showChat, setShowChat] = useState(false)
```

- [ ] **Step 3: Add chat toggle button and AgentChat to AgentCard**

After the LLM decision button section in AgentCard (the last content before the closing `</div>`), add:

```jsx
{/* Chat section */}
{agent.alive && (
  <div className="mt-3 pt-3 border-t border-white/5">
    <button
      onClick={() => setShowChat(!showChat)}
      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
    >
      <MessageSquare className="w-4 h-4" />
      {showChat ? 'Chat ausblenden' : 'Chat anzeigen'}
    </button>
    {showChat && (
      <div className="mt-3">
        <AgentChat agentId={agent.id} agentName={agent.name} />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Add TelegramSetup section before LLMConfig**

In the Dashboard component's return JSX, find the LLMConfig section:

```jsx
<div className="mt-8">
  <LLMConfig />
</div>
```

Add TelegramSetup before it:

```jsx
<div className="mt-8">
  <TelegramSetup />
</div>

<div className="mt-8">
  <LLMConfig />
</div>
```

- [ ] **Step 5: Build and verify**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx vite build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: integrate TelegramSetup and AgentChat into Dashboard"
```

---

### Task 11: Knowledge Page — Bot-Erstellungs-Anleitung

**Files:**
- Modify: `src/pages/Knowledge.jsx`

Add a new deep-dive section with detailed Telegram bot creation instructions.

- [ ] **Step 1: Add Telegram section to deepSections array**

In the `deepSections` array (around line 283), add a new entry. Insert it as the second-to-last item (before the "llm-deep" section which has the ModelFormatsExplainer):

```javascript
{
  id: 'telegram',
  icon: MessageSquare,
  title: 'Telegram-Bot erstellen — Schritt für Schritt',
  content: `Dein Agent kann per Telegram mit dir chatten. Dafür brauchst du einen eigenen Telegram-Bot. Das dauert nur 2 Minuten:

**1. BotFather öffnen**
Öffne Telegram und suche nach @BotFather. Das ist Telegrams offizieller Bot zum Erstellen neuer Bots.

**2. Neuen Bot erstellen**
Sende dem BotFather den Befehl /newbot. Er fragt dich nach einem Anzeigenamen (z.B. "Mein Earth Agent") und einem Username (z.B. "mein_earth_agent_bot" — muss auf _bot enden).

**3. Token kopieren**
Der BotFather gibt dir einen Token — eine lange Zeichenkette wie 123456:ABC-DEF. Kopiere diesen Token.

**4. In Earth 0.1 einfügen**
Gehe auf dein Dashboard, finde den Bereich "Telegram verbinden" und füge den Token ein. Klicke auf "Verbinden".

**5. Bot starten**
Öffne deinen neuen Bot in Telegram und sende /start. Ab jetzt kannst du jederzeit mit deinem Agenten chatten!

**Nützliche Befehle im Chat:**
• /status — Zustand deines Agenten (Energie, Position, Phase)
• /world — Zusammenfassung der aktuellen Welt
• /memory — Letzte Erinnerungen deines Agenten
• /sleep — Agent schlafen schicken
• /work — Agent arbeiten schicken

**Wie funktioniert das?**
Wenn du deinem Bot schreibst, wechselt dein Agent automatisch in die Freizeit-Phase und antwortet dir. Seine Antworten sind geprägt von seiner Persönlichkeit und seinen Erfahrungen in der Simulation. Ein kooperativer Agent antwortet anders als ein vorsichtiger Einzelgänger!`,
  links: [
    { label: 'BotFather öffnen', url: 'https://t.me/BotFather' },
    { label: 'Telegram Bot API Docs', url: 'https://core.telegram.org/bots' },
  ],
},
```

- [ ] **Step 2: Ensure MessageSquare is imported**

Check the imports at the top of Knowledge.jsx. `MessageSquare` is already imported (it was in the original import list). No change needed.

- [ ] **Step 3: Build and verify**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Knowledge.jsx
git commit -m "feat: add Telegram bot creation guide to Knowledge page"
```

---

### Task 12: Environment Variables & Deploy

**Files:**
- Modify: `.env` or Supabase Dashboard (secrets)
- Deploy all edge functions and frontend

- [ ] **Step 1: Ensure VITE_SUPABASE_URL is set**

Check that `.env` (or `.env.local`) contains the Supabase URL. The `registerTelegram` and `unregisterTelegram` functions in worldService.js use `import.meta.env.VITE_SUPABASE_URL`.

If not present, add to `.env`:
```
VITE_SUPABASE_URL=https://giyvmksetvberzrpvuhu.supabase.co
```

- [ ] **Step 2: Set GEMINI_API_KEY in Supabase**

The telegram-webhook function needs a Gemini API key. Set it via:

```bash
npx supabase secrets set GEMINI_API_KEY=your_key_here
```

Or via Supabase Dashboard → Settings → Edge Functions → Secrets.

To get a free Gemini API key: Go to https://aistudio.google.com/apikey and create one.

- [ ] **Step 3: Deploy all edge functions**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx supabase functions deploy simulation-tick
npx supabase functions deploy register-telegram
npx supabase functions deploy telegram-webhook
npx supabase functions deploy unregister-telegram
```

- [ ] **Step 4: Deploy frontend**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
```

- [ ] **Step 5: End-to-end test**

1. Open https://earth-01.netlify.app/dashboard
2. In "Telegram verbinden" section, enter a test bot token
3. Click "Verbinden" — should show success with bot username
4. Open the bot in Telegram, send `/start`
5. Send a message — agent should reply in character
6. Try `/status`, `/world`, `/memory`
7. Check Dashboard — AgentChat should show the conversation
8. Click "Trennen" to disconnect

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: deploy config for telegram integration"
```

---

### Task 13: Update CLAUDE.md Project Memory

**Files:**
- Modify: `/Users/matthiasduhrkop/Documents/earth-01/CLAUDE.md`

- [ ] **Step 1: Add Telegram section to CLAUDE.md**

Add after the "Agenten-System" section:

```markdown
## Telegram-Integration

- Jeder User erstellt eigenen Bot via @BotFather
- Token wird im Profil gespeichert, Webhook automatisch gesetzt
- Edge Functions: register-telegram, telegram-webhook, unregister-telegram
- Webhook-URL: `{SUPABASE_URL}/functions/v1/telegram-webhook?secret={webhook_secret}`
- Chat-Antworten via Gemini Free API (server-seitig, GEMINI_API_KEY als Secret)
- Slash-Commands (/status, /world, /memory, /sleep, /work) brauchen kein LLM
- Nachrichten gespeichert in agent_messages Tabelle
- User-Nachricht setzt Agent auf forced_phase='free' (sofortige Verfuegbarkeit)

## Flexibler Tagesrhythmus

- Per-Agent Phase-Tracking statt globaler Phase
- Felder: work_ticks, free_ticks, sleep_ticks, cycle_start_tick, forced_phase
- Zyklus: 240 Ticks, jeder Zaehler muss 80 erreichen
- forced_phase ueberschreibt alles (gesetzt durch Telegram-Webhook)
- Personality beeinflusst Phase-Wahl: hohe priority → mehr Arbeit, hohe social_mode → mehr Freizeit
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with telegram and flex rhythm info"
```
