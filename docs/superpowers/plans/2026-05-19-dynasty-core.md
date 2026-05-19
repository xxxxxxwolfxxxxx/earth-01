# Phase A — Dynastie-Kern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roguelite-Mechanik: User gründen eine Dynastie, ihr Hauptcharakter erbt sich über Generationen, Achievements bleiben in der Familie und schalten später Tools frei.

**Architecture:** Schema-Migration → Achievement-Katalog seeden → Logik-Helper in Edge-Function-Modulen → simulation-tick um Counter/Engine/Erbe/Klon erweitern → worldService-API → einfache UI für Dynasty-Gründung und Achievement-Liste.

**Tech Stack:** Supabase Postgres + Edge Functions (Deno), React + Vite frontend. Kein zusätzlicher Server. Telegram-Notifications direkt aus Edge Function via Bot-API.

**Testing approach:** Das Projekt hat keine Unit-Test-Infrastruktur — die Plan-Tasks nutzen daher konkrete SQL-Verifikationen + Deploy-and-Curl statt Vitest. Test-Setup wäre ein eigener vorgelagerter Plan. Jeder Task endet mit einer prüfbaren Verifikation.

**Out of scope für diese Phase:**
- Visuelle Aufwertung (HUD, FamilyTicker, Death-Modal, Stammbaum, Emoji-Avatare auf Karte) — Phase B
- Tool-Funktionalität (jedes Achievement schaltet nur einen Eintrag in `dynasty_achievements` frei, der Tool selber existiert noch nicht) — Phase C
- Achievement-Loss-Animation (logisch implementiert, optisch in Phase B)

---

## File Structure

**Neu:**
- `supabase/migrations/009_dynasty_redesign.sql` — Schema-Erweiterungen
- `supabase/migrations/010_achievement_catalog.sql` — Seed der 20 Achievements
- `supabase/functions/_shared/telegram.ts` — Telegram-Send-Helper
- `supabase/functions/_shared/dynasty.ts` — findHeir, scoreCandidate, evaluateCondition, cloneAgent, computeMaxAge
- `src/components/DynastyCreator.jsx` — UI für ersten Dynasty-Setup
- `src/components/AchievementGrid.jsx` — Read-only Anzeige der 20 Achievements

**Modifiziert:**
- `supabase/functions/simulation-tick/index.ts` — Counter-Updates, Engine-Aufruf, Erbe/Klon-Branching
- `src/lib/worldService.js` — setDynasty, fetchDynastyState, fetchAchievements
- `src/pages/Configurator.jsx` — DynastyCreator vorschalten falls keine Dynasty existiert
- `src/pages/Dashboard.jsx` — AchievementGrid einbinden

---

## Konventionen

- Migrations werden per `SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked` deployed
- Edge Functions per `SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy <name> --project-ref giyvmksetvberzrpvuhu --no-verify-jwt`
- Direkte SQL-Verifikation per `... npx supabase db query "<SQL>" --linked`
- Commits in der bestehenden Konvention: `<bereich>: <kurzbeschreibung>` (z.B. `db: Dynasty-Schema`, `sim: Achievement-Engine`)
- Trailing `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## Task 1: DB-Migration für Dynasty-Schema

**Files:**
- Create: `supabase/migrations/009_dynasty_redesign.sql`

- [ ] **Step 1: Migration-Datei anlegen**

Write `supabase/migrations/009_dynasty_redesign.sql`:

```sql
-- 009_dynasty_redesign.sql
-- Dynastie-Kern: Hauptchar-Zeiger, Achievement-Tabellen, Agent-Counter

-- profiles: Dynasty-Identität & optionale Tool-Keys
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_emoji TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_generation INT NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS groq_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resend_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS huggingface_key TEXT;

-- agents: Counter und Bio-Felder
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('m','f'));
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS eat_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS drink_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tiles_visited JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS trades_completed INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS display_name TEXT;
-- display_name: "Gisela 03" — wird beim Erbeübergang/Klon-Spawn gesetzt.

-- Achievement-Katalog (Seed in 010)
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 4),
  description TEXT NOT NULL,
  unlock_condition JSONB NOT NULL,
  tool_id TEXT NOT NULL,
  key_class TEXT NOT NULL CHECK (key_class IN ('builtin','extended')),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pro-User freigeschaltete Achievements
CREATE TABLE IF NOT EXISTS public.dynasty_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id),
  unlocked_by_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_dynasty_achievements_user ON public.dynasty_achievements(user_id);

-- Tool-Usage-Log (für Phase C — Rate-Limiting; jetzt nur Schema)
CREATE TABLE IF NOT EXISTS public.tool_usage_log (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, tool_id, date)
);

-- RLS-Policies
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements: everyone reads" ON public.achievements;
CREATE POLICY "achievements: everyone reads" ON public.achievements
  FOR SELECT USING (true);

ALTER TABLE public.dynasty_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dynasty_achievements: owner reads" ON public.dynasty_achievements;
CREATE POLICY "dynasty_achievements: owner reads" ON public.dynasty_achievements
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dynasty_achievements: service writes" ON public.dynasty_achievements;
CREATE POLICY "dynasty_achievements: service writes" ON public.dynasty_achievements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.tool_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_usage_log: owner reads" ON public.tool_usage_log;
CREATE POLICY "tool_usage_log: owner reads" ON public.tool_usage_log
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tool_usage_log: service writes" ON public.tool_usage_log;
CREATE POLICY "tool_usage_log: service writes" ON public.tool_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Migration anwenden**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
```

Expected: Output zeigt `Applying migration 009_dynasty_redesign.sql...` und endet mit Erfolgsmeldung ohne Fehler.

- [ ] **Step 3: Schema verifizieren**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('main_agent_id','dynasty_name','dynasty_emoji','dynasty_generation','groq_api_key','resend_api_key','huggingface_key') ORDER BY column_name" --linked
```

Expected: 7 Zeilen — `dynasty_emoji`, `dynasty_generation`, `dynasty_name`, `groq_api_key`, `huggingface_key`, `main_agent_id`, `resend_api_key`.

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT to_regclass('public.achievements'), to_regclass('public.dynasty_achievements'), to_regclass('public.tool_usage_log')" --linked
```

Expected: alle drei Werte nicht-null.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/009_dynasty_redesign.sql && git commit -m "$(cat <<'EOF'
db: Dynastie-Schema-Migration (009)

Erweitert profiles um main_agent_id, dynasty_name/emoji/generation
und optionale Drittanbieter-Keys. Neue Tabellen achievements,
dynasty_achievements, tool_usage_log mit RLS. agents bekommt
Counter-Felder (eat_count, drink_count, tiles_visited,
trades_completed) sowie gender und display_name.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Achievement-Katalog seeden

**Files:**
- Create: `supabase/migrations/010_achievement_catalog.sql`

- [ ] **Step 1: Seed-Migration schreiben**

Write `supabase/migrations/010_achievement_catalog.sql`:

```sql
-- 010_achievement_catalog.sql
-- 20 Achievements als Konstanten gespeichert. Jedes Achievement
-- referenziert ein tool_id; die Tool-Edge-Functions werden in Phase C
-- geschrieben.

INSERT INTO public.achievements (id, name, icon, tier, description, unlock_condition, tool_id, key_class, display_order) VALUES
-- Tier 1 — Anfang
('schriftgelehrte', 'Schriftgelehrte:r', '📚', 1, 'Erforsche die Tech "Schrift".', '{"type":"tech_researched","tech":"writing"}', 'web_search', 'builtin', 11),
('zeitmesser', 'Zeitmesser:in', '🕰️', 1, 'Baue dein erstes Gebäude.', '{"type":"tile_built","tile_type":"b","min":1}', 'reminder', 'builtin', 12),
('versorger', 'Versorger:in', '🌾', 1, 'Baue deine erste Farm.', '{"type":"tile_built","tile_type":"F","min":1}', 'shopping_list', 'builtin', 13),
('koch', 'Koch/Köchin', '🍳', 1, 'Iss 50 Mal.', '{"type":"action_count","action":"eat","min":50}', 'recipe_helper', 'extended', 14),
('erkunder', 'Erkunder:in', '🌍', 1, 'Besuche 30 verschiedene Tiles.', '{"type":"tiles_visited","min":30}', 'travel_info', 'builtin', 15),
('wassersucher', 'Wassersucher:in', '💧', 1, 'Trink 20 Mal.', '{"type":"action_count","action":"drink","min":20}', 'weather', 'builtin', 16),

-- Tier 2 — Aufstieg
('diplomat', 'Diplomat:in', '🤝', 2, 'Gründe deine erste Allianz.', '{"type":"alliance_founded","min":1}', 'multi_agent_chat', 'extended', 21),
('kuenstler', 'Künstler:in', '🎨', 2, 'Erforsche die Tech "Philosophie".', '{"type":"tech_researched","tech":"philosophy"}', 'image_generate', 'extended', 22),
('patriarch', 'Patriarch:in', '🧬', 2, 'Habe 3 lebende Nachfahren gleichzeitig.', '{"type":"descendants_alive","min":3}', 'family_memory', 'builtin', 23),
('heiler', 'Heiler:in', '⚕️', 2, 'Erforsche die Tech "Medizin".', '{"type":"tech_researched","tech":"medicine"}', 'symptom_tracker', 'builtin', 24),
('haendler', 'Händler:in', '💰', 2, '5 Handels-Aktionen abgeschlossen.', '{"type":"trades_completed","min":5}', 'price_compare', 'extended', 25),
('baumeister', 'Baumeister:in', '🏗️', 2, 'Erforsche die Tech "Maurerei".', '{"type":"tech_researched","tech":"masonry"}', 'project_manager', 'builtin', 26),

-- Tier 3 — Meister
('ingenieur', 'Ingenieur:in', '⚒️', 3, 'Erforsche die Tech "Ingenieurwesen".', '{"type":"tech_researched","tech":"engineering"}', 'math_eval', 'builtin', 31),
('beschuetzer', 'Beschützer:in', '🛡️', 3, '10 Kills als Wache.', '{"type":"kills","min":10}', 'security_check', 'extended', 32),
('geschichtsschreiber', 'Geschichtsschreiber:in', '📜', 3, 'Erreiche Generation 3.', '{"type":"generation_reached","min":3}', 'diary', 'builtin', 33),
('gesetzgeber', 'Gesetzgeber:in', '⚖️', 3, 'Erforsche die Tech "Demokratie".', '{"type":"tech_researched","tech":"democracy"}', 'decision_helper', 'extended', 34),
('polyglott', 'Polyglott', '🌐', 3, 'Sei in 5 verschiedenen Allianzen gewesen.', '{"type":"alliances_distinct","min":5}', 'translator', 'extended', 35),

-- Tier 4 — Meta
('dynastie', 'Dynastie', '👑', 4, 'Erreiche Generation 5.', '{"type":"generation_reached","min":5}', 'personality_style', 'builtin', 41),
('legende', 'Legende', '🏆', 4, 'Schalte 10+ andere Achievements frei.', '{"type":"achievement_count","min":10}', 'email_send', 'extended', 42),
('weiser', 'Weise:r', '🧠', 4, 'Erforsche alle 12 Techs.', '{"type":"all_techs_researched"}', 'autonomous_mode', 'builtin', 43)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  unlock_condition = EXCLUDED.unlock_condition,
  tool_id = EXCLUDED.tool_id,
  key_class = EXCLUDED.key_class,
  display_order = EXCLUDED.display_order;
```

- [ ] **Step 2: Anwenden**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
```

Expected: `Applying migration 010_achievement_catalog.sql...` ohne Fehler.

- [ ] **Step 3: Verifizieren**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE tier=1) AS t1, COUNT(*) FILTER (WHERE tier=2) AS t2, COUNT(*) FILTER (WHERE tier=3) AS t3, COUNT(*) FILTER (WHERE tier=4) AS t4 FROM public.achievements" --linked
```

Expected: `total=20, t1=6, t2=6, t3=5, t4=3`.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/010_achievement_catalog.sql && git commit -m "$(cat <<'EOF'
db: Achievement-Katalog Seed (010)

20 Achievements über 4 Tiers, jedes mit unlock_condition (JSONB)
und tool_id. ON CONFLICT DO UPDATE erlaubt späteres Anpassen
von Texten ohne Daten zu verlieren.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Telegram-Send-Helper

**Files:**
- Create: `supabase/functions/_shared/telegram.ts`

- [ ] **Step 1: Helper schreiben**

Write `supabase/functions/_shared/telegram.ts`:

```typescript
// Shared Telegram-Send-Helper für Edge Functions.
// Liest Bot-Token + Chat-ID aus profiles, ruft Telegram Bot API direkt auf.

export interface TelegramTarget {
  bot_token: string | null;
  chat_id: string | null;
}

export async function sendTelegramMessage(
  target: TelegramTarget,
  text: string
): Promise<boolean> {
  if (!target.bot_token || !target.chat_id) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${target.bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target.chat_id,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    if (!res.ok) {
      console.warn("Telegram send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Telegram send exception:", (err as Error).message);
    return false;
  }
}

// Hilfsfunktion: Profile-Row enthält die Telegram-Felder bereits
export function targetFromProfile(profile: {
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
}): TelegramTarget {
  return {
    bot_token: profile.telegram_bot_token ?? null,
    chat_id: profile.telegram_chat_id ?? null,
  };
}
```

- [ ] **Step 2: Commit (Edge Functions werden in Task 5 ff. gemeinsam deployed)**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/telegram.ts && git commit -m "$(cat <<'EOF'
sim: Shared Telegram-Send-Helper

Standalone-Modul für alle Edge Functions die Notifications schicken
müssen (simulation-tick für Tod/Achievements, später tools/* für
Sprache und Email). HTML-Modus, schlucken Fehler statt zu crashen.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Dynasty-Logik-Helper

**Files:**
- Create: `supabase/functions/_shared/dynasty.ts`

- [ ] **Step 1: Types und Constants**

Write erster Block in `supabase/functions/_shared/dynasty.ts`:

```typescript
// Shared Dynasty-Logik für simulation-tick.
// Pure Funktionen wo möglich. Supabase-Client-Aufrufe in Wrappern.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const BASE_MAX_AGE = 2400;
export const ACHIEVEMENT_BONUS_TICKS = 800;

export interface AgentRow {
  id: string;
  owner_id: string | null;
  parent_a_id: string | null;
  parent_b_id: string | null;
  generation: number;
  alive: boolean;
  energy: number;
  age: number;
  max_age: number;
  reputation: number;
  personality: Record<string, number>;
  x: number;
  y: number;
  gender: "m" | "f" | null;
  display_name: string | null;
}

export interface ProfileRow {
  id: string;
  main_agent_id: string | null;
  dynasty_name: string | null;
  dynasty_emoji: string | null;
  dynasty_generation: number;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
}
```

- [ ] **Step 2: max_age-Formel**

Append zu `supabase/functions/_shared/dynasty.ts`:

```typescript
export function computeMaxAge(achievementCount: number, rand: () => number = Math.random): number {
  const jitter = Math.floor((rand() - 0.5) * 400); // ±200 ticks
  return BASE_MAX_AGE + achievementCount * ACHIEVEMENT_BONUS_TICKS + jitter;
}
```

- [ ] **Step 3: scoreCandidate**

Append:

```typescript
export function scoreCandidate(agent: AgentRow): number {
  const repPart = Math.max(0, agent.reputation) * 0.5;
  const energyPart = (Math.max(0, agent.energy) / 100) * 0.3;
  const agePart = Math.min(1, agent.age / Math.max(1, agent.max_age)) * 0.2;
  return repPart + energyPart + agePart;
}
```

- [ ] **Step 4: findHeir (rekursiv über lebende Nachfahren)**

Append:

```typescript
// Liefert den besten lebenden Nachfahren des verstorbenen Agenten,
// rekursiv durch alle Generationen. allAgents MUSS lebende UND tote
// Agenten enthalten — wir traversieren den Stammbaum durch tote
// Vorfahren, um lebende Enkel/Urenkel zu erreichen.
export function findHeir(
  deadAgentId: string,
  allAgents: AgentRow[],
): AgentRow | null {
  // BFS durch alle Agenten (lebend + tot), um Descendants-Set zu bauen
  const descendants = new Set<string>([deadAgentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of allAgents) {
      if (descendants.has(a.id)) continue;
      if (
        (a.parent_a_id && descendants.has(a.parent_a_id)) ||
        (a.parent_b_id && descendants.has(a.parent_b_id))
      ) {
        descendants.add(a.id);
        changed = true;
      }
    }
  }
  descendants.delete(deadAgentId);

  // Nur lebende Nachfahren als Kandidaten
  const livingDescendants = allAgents.filter(
    (a) => a.alive && descendants.has(a.id),
  );
  if (livingDescendants.length === 0) return null;

  // Direkte lebende Kinder bevorzugen, sonst gesamter lebender Pool
  const livingChildren = livingDescendants.filter(
    (a) => a.parent_a_id === deadAgentId || a.parent_b_id === deadAgentId,
  );
  const pool = livingChildren.length > 0 ? livingChildren : livingDescendants;

  let best = pool[0];
  let bestScore = scoreCandidate(best);
  for (let i = 1; i < pool.length; i++) {
    const s = scoreCandidate(pool[i]);
    if (s > bestScore) {
      best = pool[i];
      bestScore = s;
    }
  }
  return best;
}
```

- [ ] **Step 5: evaluateCondition**

Append:

```typescript
// Kontext für die Condition-Evaluierung.
export interface ConditionContext {
  agent: AgentRow;
  achievementCount: number;
  techResearched: Set<string>;       // alle erforschten tech_id Strings
  alliancesFoundedByAgent: number;
  alliancesDistinct: number;
  descendantsAlive: number;
  killsByAgent: number;
  buildingsByAgent: Map<string, number>; // tile_type → count
}

export function evaluateCondition(
  condition: Record<string, unknown>,
  ctx: ConditionContext,
): boolean {
  const type = condition.type as string;
  switch (type) {
    case "tech_researched":
      return ctx.techResearched.has(condition.tech as string);
    case "action_count": {
      const action = condition.action as string;
      const min = condition.min as number;
      if (action === "eat") return (ctx.agent as any).eat_count >= min;
      if (action === "drink") return (ctx.agent as any).drink_count >= min;
      return false;
    }
    case "tiles_visited":
      return Array.isArray((ctx.agent as any).tiles_visited) &&
        (ctx.agent as any).tiles_visited.length >= (condition.min as number);
    case "alliance_founded":
      return ctx.alliancesFoundedByAgent >= (condition.min as number);
    case "alliances_distinct":
      return ctx.alliancesDistinct >= (condition.min as number);
    case "tile_built": {
      const tileType = condition.tile_type as string;
      const min = condition.min as number;
      return (ctx.buildingsByAgent.get(tileType) ?? 0) >= min;
    }
    case "trades_completed":
      return (ctx.agent as any).trades_completed >= (condition.min as number);
    case "kills":
      return ctx.killsByAgent >= (condition.min as number);
    case "generation_reached":
      return ctx.agent.generation >= (condition.min as number);
    case "descendants_alive":
      return ctx.descendantsAlive >= (condition.min as number);
    case "achievement_count":
      return ctx.achievementCount >= (condition.min as number);
    case "all_techs_researched":
      return ctx.techResearched.size >= 12;
    default:
      return false;
  }
}
```

- [ ] **Step 6: cloneAgent-Helper**

Append:

```typescript
// Baut die Felder für einen Klon-Spawn basierend auf dem verstorbenen Agenten.
// Personality-Mutation ±0.1 pro Slider, Position = letzte Position,
// neue ID + Gen 0.
export interface CloneSpec {
  owner_id: string;
  name: string;
  display_name: string;
  personality: Record<string, number>;
  x: number;
  y: number;
  energy: number;
  max_age: number;
  generation: number;
  gender: "m" | "f";
  parent_a_id: null;
  parent_b_id: null;
}

export function buildClone(
  dead: AgentRow,
  newMaxAge: number,
  dynastyName: string,
  rand: () => number = Math.random,
): CloneSpec {
  const mutated: Record<string, number> = {};
  for (const k of Object.keys(dead.personality)) {
    const delta = (rand() - 0.5) * 0.2;
    mutated[k] = Math.max(0, Math.min(1, dead.personality[k] + delta));
  }
  return {
    owner_id: dead.owner_id!,
    name: dynastyName,
    display_name: `${dynastyName} 01`,
    personality: mutated,
    x: dead.x,
    y: dead.y,
    energy: 60,
    max_age: newMaxAge,
    generation: 0,
    gender: rand() < 0.5 ? "m" : "f",
    parent_a_id: null,
    parent_b_id: null,
  };
}
```

- [ ] **Step 7: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/dynasty.ts && git commit -m "$(cat <<'EOF'
sim: Shared Dynasty-Logik (findHeir, evaluateCondition, buildClone)

Pure Funktionen für Erbsuche, Achievement-Bedingungs-Prüfung
und Klon-Spawn-Felder-Berechnung. max_age-Formel:
2400 + achievementCount * 800 ± 200.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: simulation-tick — Counter-Updates bei Aktionen

**Files:**
- Modify: `supabase/functions/simulation-tick/index.ts`

- [ ] **Step 1: Imports oben einfügen**

Edit `supabase/functions/simulation-tick/index.ts`. Direkt nach der bestehenden Import-Zeile (`import { createClient } from ...`) einfügen:

```typescript
import { sendTelegramMessage, targetFromProfile } from "../_shared/telegram.ts";
import {
  AgentRow as DAgentRow,
  ProfileRow as DProfileRow,
  computeMaxAge,
  findHeir,
  evaluateCondition,
  buildClone,
  ConditionContext,
} from "../_shared/dynasty.ts";
```

- [ ] **Step 2: eat-Aktion zählen**

Edit `supabase/functions/simulation-tick/index.ts`. Suche die `eat`-Aktion-Behandlung (grep nach `action.*eat` oder `"eat"`). Im Block in dem Energie hinzugefügt wird, ergänze direkt vor dem Schließen des Action-Blocks:

```typescript
(agent as any).eat_count = ((agent as any).eat_count ?? 0) + 1;
```

(Genaue Position: nach `agent.energy = Math.min(100, agent.energy + ...)` und vor dem Aktions-Log.)

- [ ] **Step 3: drink-Aktion zählen**

Ähnlich für `drink`-Aktion-Block:

```typescript
(agent as any).drink_count = ((agent as any).drink_count ?? 0) + 1;
```

- [ ] **Step 4: tile-visit zählen**

Bei jeder Bewegungs-Aktion (`move`/`explore`), nachdem `agent.x` und `agent.y` aktualisiert wurden, einfügen:

```typescript
const visited: number[] = (agent as any).tiles_visited ?? [];
const tileKey = agent.y * 60 + agent.x;
if (!visited.includes(tileKey)) {
  visited.push(tileKey);
  if (visited.length > 200) visited.shift(); // cap to avoid bloat
  (agent as any).tiles_visited = visited;
}
```

- [ ] **Step 5: trade-Aktion zählen**

Im Trade-Action-Block, nach erfolgreichem Trade:

```typescript
(agent as any).trades_completed = ((agent as any).trades_completed ?? 0) + 1;
```

- [ ] **Step 6: Sicherstellen dass Counter in UPDATE landen**

Im finalen Batch-Update-Block (suche `update agents` mit den Action-Counter-Spalten der bestehenden Implementierung). Ergänze in der Felder-Liste die neuen Counter:

```typescript
// im pro-Agent-Update am Tick-Ende:
eat_count: (agent as any).eat_count ?? 0,
drink_count: (agent as any).drink_count ?? 0,
tiles_visited: (agent as any).tiles_visited ?? [],
trades_completed: (agent as any).trades_completed ?? 0,
```

- [ ] **Step 7: Deploy & in DB prüfen**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy simulation-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

Then trigger a tick:
```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Verify counters wachsen:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT name, eat_count, drink_count, trades_completed, jsonb_array_length(tiles_visited) AS visited_count FROM agents WHERE alive=true ORDER BY eat_count DESC LIMIT 5" --linked
```

Expected: mindestens ein Agent hat `eat_count > 0` oder `drink_count > 0` oder `visited_count > 0` nach mehreren Ticks. Falls noch alles 0 ist: zweimal `curl` ausführen, dann nochmal.

- [ ] **Step 8: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/simulation-tick/index.ts && git commit -m "$(cat <<'EOF'
sim: Counter-Updates bei Agenten-Aktionen

eat_count, drink_count, tiles_visited und trades_completed werden
pro Tick aktualisiert und mit den restlichen Agent-Feldern
zurückgeschrieben. Voraussetzung für die Achievement-Engine.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: simulation-tick — Achievement-Engine

**Files:**
- Modify: `supabase/functions/simulation-tick/index.ts`

- [ ] **Step 1: Engine-Funktion einfügen**

Edit `supabase/functions/simulation-tick/index.ts`. Direkt vor dem `serve(...)`-Aufruf am Dateiende, eine neue Async-Funktion einfügen:

```typescript
async function processAchievementsForUsers(
  supabase: ReturnType<typeof createClient>,
  livingAgents: any[],
  worldTech: { researched: string[] },
  alliances: any[],
): Promise<void> {
  // 1. Hole alle Profile mit main_agent_id
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, telegram_bot_token, telegram_chat_id")
    .not("main_agent_id", "is", null);
  if (profErr || !profiles) return;

  // 2. Hole alle Achievements (Katalog) und alle freigeschalteten
  const { data: catalog } = await supabase.from("achievements").select("*");
  const { data: unlocked } = await supabase
    .from("dynasty_achievements")
    .select("user_id, achievement_id");
  if (!catalog || !unlocked) return;

  const unlockedByUser = new Map<string, Set<string>>();
  for (const row of unlocked) {
    if (!unlockedByUser.has(row.user_id)) unlockedByUser.set(row.user_id, new Set());
    unlockedByUser.get(row.user_id)!.add(row.achievement_id);
  }

  // 3. Pro Profile: für jeden noch-nicht-freigeschalteten Achievement prüfen
  const techSet = new Set(worldTech.researched ?? []);
  for (const profile of profiles) {
    const mainAgent = livingAgents.find((a) => a.id === profile.main_agent_id);
    if (!mainAgent) continue;
    const userUnlocked = unlockedByUser.get(profile.id) ?? new Set<string>();

    // Nachfahren-Zähler
    const descendants = countLivingDescendants(mainAgent.id, livingAgents);
    // Buildings-Counter aus actions vergangener Ticks → vereinfacht: hier 0,
    // wird vom Tick-Action-Code direkt gefüllt (siehe Schritt 2).
    const buildingsByAgent = new Map<string, number>();
    const myBuildings = (mainAgent as any).buildings_built ?? {};
    for (const k of Object.keys(myBuildings)) buildingsByAgent.set(k, myBuildings[k]);
    // Alliances
    const myAlliances = alliances.filter((a) =>
      a.member_ids?.includes(mainAgent.id) || a.founder_id === mainAgent.id
    );
    const founded = alliances.filter((a) => a.founder_id === mainAgent.id).length;
    const distinct = myAlliances.length;
    // Kills (existiert schon auf agent-Tabelle aus migration 006)
    const kills = (mainAgent as any).kills ?? 0;

    const ctx: ConditionContext = {
      agent: mainAgent as DAgentRow,
      achievementCount: userUnlocked.size,
      techResearched: techSet,
      alliancesFoundedByAgent: founded,
      alliancesDistinct: distinct,
      descendantsAlive: descendants,
      killsByAgent: kills,
      buildingsByAgent,
    };

    for (const ach of catalog) {
      if (userUnlocked.has(ach.id)) continue;
      if (!evaluateCondition(ach.unlock_condition as any, ctx)) continue;

      // Unlock!
      await supabase.from("dynasty_achievements").insert({
        user_id: profile.id,
        achievement_id: ach.id,
        unlocked_by_agent_id: mainAgent.id,
      });
      await supabase.from("world_events").insert({
        tick: (mainAgent as any).tick ?? 0,
        event_type: "achievement_unlocked",
        detail: {
          user_id: profile.id,
          agent_id: mainAgent.id,
          achievement_id: ach.id,
          achievement_name: ach.name,
          icon: ach.icon,
        },
      });
      // Telegram
      await sendTelegramMessage(targetFromProfile(profile as any),
        `${ach.icon} <b>${profile.dynasty_name}</b> hat <b>${ach.name}</b> freigeschaltet!\n\n${ach.description}\nTool <code>${ach.tool_id}</code> ist nun verfügbar.`
      );
      userUnlocked.add(ach.id);
    }
  }
}

function countLivingDescendants(rootId: string, agents: any[]): number {
  const set = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of agents) {
      if (!a.alive || set.has(a.id)) continue;
      if (
        (a.parent_a_id && set.has(a.parent_a_id)) ||
        (a.parent_b_id && set.has(a.parent_b_id))
      ) {
        set.add(a.id);
        changed = true;
      }
    }
  }
  set.delete(rootId);
  return set.size;
}
```

- [ ] **Step 2: buildings_built-Counter aufnehmen**

Bei jeder erfolgreichen `build`-Aktion in der bestehenden simulation-tick (grep `"build"`), nach erfolgreichem Tile-Wechsel:

```typescript
const built = (agent as any).buildings_built ?? {};
const tileType = newTileType; // z.B. "b", "F", "s", "r"
built[tileType] = (built[tileType] ?? 0) + 1;
(agent as any).buildings_built = built;
```

Counter im Tick-Update der agent-Row ebenfalls schreiben:

```typescript
buildings_built: (agent as any).buildings_built ?? {},
```

Hinweis: `buildings_built` ist eine JSONB-Spalte. Erweitere Migration 009 entsprechend:

Edit `supabase/migrations/009_dynasty_redesign.sql`, ergänze unter den Agent-ALTER-Statements:

```sql
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS buildings_built JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Migration erneut anwenden:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
```

- [ ] **Step 3: Engine-Aufruf in Tick-Schleife einfügen**

In `supabase/functions/simulation-tick/index.ts`, am Ende der inneren Tick-Schleife (nach dem Schreiben aller Agent-Updates), füge ein:

```typescript
// Achievement-Engine — läuft am Tick-Ende, nutzt die frischen Agent-Daten
const { data: livingAgentsFresh } = await supabase
  .from("agents").select("*").eq("alive", true);
const { data: worldTechFresh } = await supabase
  .from("world_tech").select("*").single();
const { data: alliancesFresh } = await supabase
  .from("alliances").select("*");
await processAchievementsForUsers(
  supabase,
  livingAgentsFresh ?? [],
  worldTechFresh ?? { researched: [] },
  alliancesFresh ?? [],
);
```

- [ ] **Step 4: Deploy**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy simulation-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 5: Test mit künstlichem Unlock**

Erstmal manuell eine Bedingung künstlich erfüllbar machen, um die Engine zu testen. Setze für einen lebenden Agenten eat_count auf 50:

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE profiles SET main_agent_id = (SELECT id FROM agents WHERE alive=true LIMIT 1) WHERE main_agent_id IS NULL; UPDATE agents SET eat_count = 60 WHERE id = (SELECT main_agent_id FROM profiles WHERE main_agent_id IS NOT NULL LIMIT 1)" --linked
```

Tick triggern:
```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Achievement prüfen:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT * FROM dynasty_achievements WHERE achievement_id='koch'" --linked
```

Expected: mindestens eine Zeile mit `achievement_id='koch'`.

- [ ] **Step 6: Aufräumen — Test-Unlock zurücknehmen** (falls erwünscht, sonst behalten als initialen Stand)

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "DELETE FROM dynasty_achievements WHERE achievement_id='koch'" --linked
```

- [ ] **Step 7: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/simulation-tick/index.ts supabase/migrations/009_dynasty_redesign.sql && git commit -m "$(cat <<'EOF'
sim: Achievement-Engine in simulation-tick

processAchievementsForUsers läuft am Ende jedes Ticks für jeden
User mit main_agent_id. Prüft alle nicht-freigeschalteten
Achievements gegen den aktuellen Zustand, schreibt unlocks in
dynasty_achievements, loggt world_events und benachrichtigt
per Telegram. Pflegt zusätzlich buildings_built JSONB-Counter
pro Agent.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: simulation-tick — Tod und Erbsuche

**Files:**
- Modify: `supabase/functions/simulation-tick/index.ts`

- [ ] **Step 1: Hilfsfunktion processDeath einfügen**

Edit `supabase/functions/simulation-tick/index.ts`, neben `processAchievementsForUsers`:

```typescript
async function processDeaths(
  supabase: ReturnType<typeof createClient>,
  deadAgentIds: string[],
): Promise<void> {
  if (deadAgentIds.length === 0) return;
  // Hole alle relevanten profiles (Hauptchar verloren?) und alle lebenden Agents
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, telegram_bot_token, telegram_chat_id")
    .in("main_agent_id", deadAgentIds);
  if (!profiles || profiles.length === 0) return;
  // findHeir braucht lebende UND tote Agenten zur Stammbaum-Traversierung.
  // Wir filtern auf die owner_ids der betroffenen User, um Bound zu halten.
  const ownerIds = profiles.map((p) => p.id);
  const { data: ownerAgents } = await supabase
    .from("agents").select("*").in("owner_id", ownerIds);
  const allAgents = (ownerAgents ?? []) as DAgentRow[];
  const { data: deadAgents } = await supabase
    .from("agents").select("*").in("id", deadAgentIds);

  for (const profile of profiles) {
    const dead = deadAgents?.find((a) => a.id === profile.main_agent_id);
    if (!dead) continue;
    const cause = (dead as any).cause_of_death ?? "unknown";

    const heir = findHeir(dead.id, allAgents);
    if (heir) {
      // Erbe übernimmt
      const newGen = profile.dynasty_generation + 1;
      const newDisplayName = `${profile.dynasty_name} ${String(newGen).padStart(2,"0")}`;
      await supabase.from("agents").update({ display_name: newDisplayName })
        .eq("id", heir.id);
      await supabase.from("profiles").update({
        main_agent_id: heir.id,
        dynasty_generation: newGen,
      }).eq("id", profile.id);
      await supabase.from("world_events").insert({
        tick: (dead as any).age ?? 0,
        event_type: "dynasty_succession",
        detail: {
          user_id: profile.id,
          deceased_id: dead.id,
          deceased_display: (dead as any).display_name ?? profile.dynasty_name,
          cause,
          heir_id: heir.id,
          heir_display: newDisplayName,
          generation: newGen,
        },
      });
      await sendTelegramMessage(targetFromProfile(profile as any),
        `👑 <b>${(dead as any).display_name ?? profile.dynasty_name}</b> ist gestorben (${cause}).\n\nDie Linie wird fortgeführt von <b>${newDisplayName}</b> (Generation ${newGen}).`
      );
    } else {
      // Kinderlos → Klon
      const { count: achCount } = await supabase
        .from("dynasty_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      const newMaxAge = computeMaxAge(achCount ?? 0);
      const clone = buildClone(dead as DAgentRow, newMaxAge, profile.dynasty_name ?? "Dynasty");

      // Insert clone und main_agent neu setzen
      const { data: insertedClone } = await supabase
        .from("agents").insert(clone).select().single();
      if (insertedClone) {
        await supabase.from("profiles").update({
          main_agent_id: insertedClone.id,
          dynasty_generation: 1,
        }).eq("id", profile.id);
      }

      // Jüngstes Achievement strippen (höchstes unlocked_at)
      const { data: latest } = await supabase
        .from("dynasty_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", profile.id)
        .order("unlocked_at", { ascending: false })
        .limit(1);
      let lostName = "";
      if (latest && latest.length > 0) {
        const lostId = latest[0].achievement_id;
        const { data: lostAch } = await supabase
          .from("achievements").select("name, icon").eq("id", lostId).single();
        lostName = lostAch ? `${lostAch.icon} ${lostAch.name}` : lostId;
        await supabase.from("dynasty_achievements")
          .delete()
          .eq("user_id", profile.id).eq("achievement_id", lostId);
      }

      await supabase.from("world_events").insert({
        tick: (dead as any).age ?? 0,
        event_type: "dynasty_childless_restart",
        detail: {
          user_id: profile.id,
          deceased_id: dead.id,
          cause,
          lost_achievement: lostName,
          clone_id: insertedClone?.id ?? null,
        },
      });
      await sendTelegramMessage(targetFromProfile(profile as any),
        `💔 Familie <b>${profile.dynasty_name}</b> ist ausgestorben.\n\nEin Klon-Nachfolger versucht erneut. Verloren: ${lostName || "(noch nichts)"}.`
      );
    }
  }
}
```

- [ ] **Step 2: Engine-Aufruf nach Counter-Engine einfügen**

In `simulation-tick/index.ts`, am Tick-Ende, **vor** `processAchievementsForUsers`-Aufruf:

```typescript
// processDeaths verarbeitet alle in diesem Tick verstorbenen Hauptchars
const deadIds = deaths; // die existierende deaths-Liste aus dem Tick
await processDeaths(supabase, deadIds);
```

(`deaths` ist die bestehende Variable die in der Tick-Schleife befüllt wird — siehe grep `cause_of_death` für Beispiele.)

- [ ] **Step 3: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy simulation-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 4: Test mit gezieltem Tod**

Wähle einen Test-User mit Hauptchar. Erstelle künstlich ein Kind, lasse Hauptchar sterben, prüfe ob Kind übernimmt:

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
-- 1. Hauptchar bestimmen
WITH main AS (SELECT main_agent_id FROM profiles WHERE main_agent_id IS NOT NULL LIMIT 1)
-- 2. Künstliches Kind anlegen
INSERT INTO agents (owner_id, name, personality, x, y, energy, max_age, generation, parent_a_id, alive, gender)
SELECT p.id, 'TestKind', '{\"priority\":0.5,\"social_mode\":0.5,\"risk_tolerance\":0.5,\"curiosity\":0.5,\"cooperation\":0.5}'::jsonb, a.x, a.y, 80, 3000, 1, a.id, true, 'f'
FROM profiles p JOIN agents a ON a.id = p.main_agent_id WHERE a.alive=true LIMIT 1
RETURNING id, parent_a_id;
" --linked
```

Hauptchar töten:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE agents SET alive=false, energy=0, cause_of_death='manual_test' WHERE id = (SELECT main_agent_id FROM profiles WHERE main_agent_id IS NOT NULL LIMIT 1)" --linked
```

Tick triggern und Übernahme prüfen:
```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
sleep 2
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT p.dynasty_generation, a.id, a.display_name FROM profiles p JOIN agents a ON a.id = p.main_agent_id WHERE p.main_agent_id IS NOT NULL LIMIT 1" --linked
```

Expected: `dynasty_generation` ist um 1 höher als vorher; `display_name` enthält "<dynasty> 02" o.ä.; `id` zeigt auf den TestKind, nicht den toten Original-Agenten.

`world_events` prüfen:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT event_type, detail FROM world_events WHERE event_type IN ('dynasty_succession','dynasty_childless_restart') ORDER BY id DESC LIMIT 3" --linked
```

Expected: ein Eintrag mit `dynasty_succession`.

- [ ] **Step 5: Test ohne Kind = Klon-Spawn**

TestKind und Hauptchar beide töten, Tick triggern:

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE agents SET alive=false, cause_of_death='manual_test' WHERE name='TestKind' OR id=(SELECT main_agent_id FROM profiles WHERE main_agent_id IS NOT NULL LIMIT 1)" --linked
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
sleep 2
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT p.dynasty_generation, a.id, a.display_name, a.generation FROM profiles p JOIN agents a ON a.id = p.main_agent_id WHERE p.main_agent_id IS NOT NULL LIMIT 1" --linked
```

Expected: `dynasty_generation` zurück auf 1, neuer Klon-Agent mit `generation=0`.

- [ ] **Step 6: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/simulation-tick/index.ts && git commit -m "$(cat <<'EOF'
sim: Tod-Verarbeitung mit Erbsuche und Klon-Spawn

processDeaths läuft am Tick-Ende für alle in diesem Tick
verstorbenen Hauptchars. Findet besten Erben oder spawnt
Klon mit Achievement-Verlust. Schickt Telegram-Notification
mit Ursache und Nachfolger-Info.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: simulation-tick — Lebensdauer-Formel beim Spawn

**Files:**
- Modify: `supabase/functions/simulation-tick/index.ts`

- [ ] **Step 1: Reproduktions-Spawn aktualisieren**

Edit `supabase/functions/simulation-tick/index.ts`. Suche die bestehende Reproduktions-Logik (grep `parent_a_id` oder `generation` Insert). Im Block der das Kind-Agent-Objekt baut, ersetze die bisherige `max_age`-Zuweisung:

Vor dem Insert das Achievement-Count des owner_id laden:

```typescript
// Vor dem Kind-Insert: Achievement-Count des Owners laden
const { count: parentAchCount } = await supabase
  .from("dynasty_achievements")
  .select("*", { count: "exact", head: true })
  .eq("user_id", parentA.owner_id ?? parentB.owner_id);
const childMaxAge = computeMaxAge(parentAchCount ?? 0);
```

Dann verwende `childMaxAge` statt der alten Formel im `max_age`-Feld.

- [ ] **Step 2: spawn-agent Edge Function aktualisieren**

Edit `supabase/functions/spawn-agent/index.ts`. Vor dem Insert des neuen Agenten:

```typescript
import { computeMaxAge } from "../_shared/dynasty.ts";
// ...
const { count: achCount } = await supabase
  .from("dynasty_achievements")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id);
const maxAge = computeMaxAge(achCount ?? 0);
```

Dann benutze `maxAge` im Insert anstelle der Zufallsformel.

- [ ] **Step 3: Deploy beide Funktionen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy simulation-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy spawn-agent --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 4: Verifizieren**

Trigger einen Tick, dann ältesten Klon prüfen:

```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT name, generation, age, max_age FROM agents ORDER BY created_at DESC LIMIT 3" --linked
```

Expected: für neu gespawnte Agenten `max_age` liegt zwischen 2200 und 2600 wenn 0 Achievements, höher wenn welche freigeschaltet.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/simulation-tick/index.ts supabase/functions/spawn-agent/index.ts && git commit -m "$(cat <<'EOF'
sim: max_age = 2400 + dynasty_achievements * 800

computeMaxAge wird beim Spawn (Configurator), Reproduktion und
Klon-Spawn aufgerufen. Mehr Achievements der Familie = längeres
Leben des nächsten Agenten.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: worldService.js — Dynasty- und Achievement-API

**Files:**
- Modify: `src/lib/worldService.js`

- [ ] **Step 1: setDynasty hinzufügen**

Edit `src/lib/worldService.js`. Direkt nach `export async function spawnAgent(...)` (oder am Dateiende) einfügen:

```javascript
// --- Dynasty & Achievements ---

export async function setDynasty({ name, emoji }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const trimmed = (name ?? '').trim()
  if (trimmed.length < 2 || trimmed.length > 20) {
    throw new Error('Dynastie-Name muss 2-20 Zeichen lang sein')
  }
  if (!emoji || emoji.length === 0) {
    throw new Error('Bitte ein Emoji wählen')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      dynasty_name: trimmed,
      dynasty_emoji: emoji,
      dynasty_generation: 1,
      dynasty_started_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) throw error
}

export async function fetchDynastyState() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, dynasty_started_at')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return {
    mainAgentId: data.main_agent_id,
    name: data.dynasty_name,
    emoji: data.dynasty_emoji,
    generation: data.dynasty_generation,
    startedAt: data.dynasty_started_at,
  }
}

export async function fetchAchievementsCatalog() {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchUnlockedAchievements() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('dynasty_achievements')
    .select('achievement_id, unlocked_at, unlocked_by_agent_id')
    .eq('user_id', user.id)

  if (error) throw error
  return data ?? []
}

export async function setMainAgent(agentId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('profiles')
    .update({ main_agent_id: agentId })
    .eq('id', user.id)

  if (error) throw error
}
```

- [ ] **Step 2: spawnAgent erweitern: max_age + display_name + main_agent**

Im bestehenden `spawnAgent` der `worldService.js`, nach erfolgreichem Insert (`return data`-Block), einfügen vor `return data`:

```javascript
// Dynasty-Daten + Achievement-Count laden für max_age und display_name
const { data: profileNow } = await supabase
  .from('profiles')
  .select('main_agent_id, dynasty_name, dynasty_generation')
  .eq('id', user.id)
  .single()

const { count: achCount } = await supabase
  .from('dynasty_achievements')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)

// Gleiche Formel wie computeMaxAge im _shared/dynasty.ts
const jitter = Math.floor((Math.random() - 0.5) * 400)
const computedMaxAge = 2400 + (achCount ?? 0) * 800 + jitter

const displayName = profileNow?.dynasty_name
  ? `${profileNow.dynasty_name} ${String(profileNow.dynasty_generation ?? 1).padStart(2, '0')}`
  : data.name

await supabase
  .from('agents')
  .update({ max_age: computedMaxAge, display_name: displayName })
  .eq('id', data.id)

if (!profileNow?.main_agent_id) {
  await supabase
    .from('profiles')
    .update({ main_agent_id: data.id })
    .eq('id', user.id)
}

// data im Speicher mit den neuen Feldern syncen für caller
data.max_age = computedMaxAge
data.display_name = displayName
```

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/lib/worldService.js && git commit -m "$(cat <<'EOF'
api: Dynasty & Achievement Frontend-Funktionen

setDynasty, fetchDynastyState, fetchAchievementsCatalog,
fetchUnlockedAchievements, setMainAgent. spawnAgent setzt
automatisch main_agent_id wenn noch keiner existiert.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: DynastyCreator-Komponente

**Files:**
- Create: `src/components/DynastyCreator.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/DynastyCreator.jsx`:

```jsx
import { useState } from 'react'
import { setDynasty } from '../lib/worldService'

const EMOJI_OPTIONS = [
  '🧙‍♀️','🧙‍♂️','👩‍🌾','👨‍🌾','👩‍🔬','👨‍🔬',
  '🧝‍♀️','🧝‍♂️','🦸‍♀️','🦸‍♂️','🥷','🧑‍🎤',
  '👩‍💼','👨‍💼','👩‍🚀','👨‍🚀','🦊','🐺',
]

export default function DynastyCreator({ onComplete }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await setDynasty({ name, emoji })
      onComplete?.({ name, emoji })
    } catch (err) {
      setError(err.message || 'Fehler beim Anlegen')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 rounded-2xl bg-white/[0.04] border border-white/10">
      <h2 className="font-display text-2xl font-bold text-white mb-2">
        Gründe deine Dynastie
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Wähle einen Namen und ein Symbol. Der Name bleibt für alle Generationen
        gleich — du chattest immer mit dieser Identität, egal wer im Spiel
        gerade die Linie führt.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            Dynastie-Name (2–20 Zeichen)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Gisela"
            maxLength={20}
            className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-4 py-3 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">
            Symbol (Emoji)
          </label>
          <div className="grid grid-cols-9 gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`text-2xl p-2 rounded-lg border transition ${
                  emoji === e
                    ? 'bg-nebula-500/30 border-nebula-400'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !emoji}
          className="w-full bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50
                     text-white font-medium py-3 rounded-lg transition"
        >
          {submitting ? 'Lege an…' : 'Dynastie gründen'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/DynastyCreator.jsx && git commit -m "$(cat <<'EOF'
ui: DynastyCreator-Komponente

Erster Setup-Schritt vor Agent-Erstellung: User wählt Dynastie-Name
und Emoji aus 18-Symbol-Auswahl. Validierung 2-20 Zeichen, Emoji
muss gesetzt sein. Ruft setDynasty aus worldService.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Configurator-Page mit Dynasty-Gate

**Files:**
- Modify: `src/pages/Configurator.jsx`

- [ ] **Step 1: useState + useEffect für Dynasty-Check**

Edit `src/pages/Configurator.jsx`. Komplette Datei ersetzen mit:

```jsx
import { useEffect, useState } from 'react'
import { Cpu, Code2, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import AgentConfigurator from '../components/AgentConfigurator'
import DynastyCreator from '../components/DynastyCreator'
import { fetchDynastyState } from '../lib/worldService'

export default function Configurator() {
  const [dynasty, setDynasty] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchDynastyState()
        setDynasty(d)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const needsDynasty = !loading && (!dynasty?.name || !dynasty?.emoji)

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <Cpu className="w-4 h-4" /> Agent-Konfigurator
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          {needsDynasty ? 'Gründe deine Dynastie' : 'Erschaffe deinen Agenten'}
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          {needsDynasty
            ? 'Bevor du deinen ersten Agenten erschaffst, brauchst du eine Familienlinie. Name und Symbol bleiben über alle Generationen erhalten.'
            : `Linie ${dynasty.emoji} ${dynasty.name} — Generation ${dynasty.generation}. Konfiguriere deinen aktuellen Agenten.`}
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Lade…</div>
      ) : needsDynasty ? (
        <DynastyCreator onComplete={(d) => setDynasty({ ...d, generation: 1 })} />
      ) : (
        <AgentConfigurator />
      )}

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <Code2 className="w-8 h-8 text-nebula-400 mb-3" />
          <h3 className="font-display text-white font-bold text-lg mb-2">Für Entwickler: API-Zugang</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Du willst volle Kontrolle? Nutze unsere REST-API direkt.
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <BookOpen className="w-8 h-8 text-life-400 mb-3" />
          <h3 className="font-display text-white font-bold text-lg mb-2">Nicht sicher, wo anfangen?</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Lies unsere Wissensbasis um zu verstehen, wie die Welt funktioniert.
          </p>
          <Link
            to="/wissen"
            className="inline-flex items-center gap-2 px-4 py-2 bg-life-500/20 text-life-400 rounded-lg text-sm no-underline hover:bg-life-500/30 transition"
          >
            <BookOpen className="w-4 h-4" /> Zur Wissensbasis
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lokal builden um Compile-Errors zu fangen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: build success ohne Fehler, Bundle wird ausgegeben.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/Configurator.jsx && git commit -m "$(cat <<'EOF'
ui: Configurator schaltet zwischen Dynasty-Gründung und Agent-Erstellung

Bei erstem Besuch zeigt /configurator den DynastyCreator. Sobald
dynasty_name und dynasty_emoji gesetzt sind, erscheint der bisherige
AgentConfigurator. Zeigt aktuelle Generation in der Headline.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: AchievementGrid-Komponente

**Files:**
- Create: `src/components/AchievementGrid.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/AchievementGrid.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { fetchAchievementsCatalog, fetchUnlockedAchievements } from '../lib/worldService'

const TIER_LABELS = {
  1: 'Tier 1 — Anfang',
  2: 'Tier 2 — Aufstieg',
  3: 'Tier 3 — Meister',
  4: 'Tier 4 — Meta',
}
const TIER_COLORS = {
  1: 'border-l-green-400',
  2: 'border-l-blue-400',
  3: 'border-l-amber-400',
  4: 'border-l-pink-400',
}

export default function AchievementGrid() {
  const [catalog, setCatalog] = useState([])
  const [unlocked, setUnlocked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [c, u] = await Promise.all([
          fetchAchievementsCatalog(),
          fetchUnlockedAchievements(),
        ])
        setCatalog(c)
        setUnlocked(u)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-gray-500">Lade Achievements…</div>

  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id))
  const byTier = { 1: [], 2: [], 3: [], 4: [] }
  for (const a of catalog) byTier[a.tier]?.push(a)

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl font-bold text-white">
          Achievements
        </h3>
        <div className="text-sm text-gray-400">
          {unlocked.length}/{catalog.length} freigeschaltet
        </div>
      </div>

      {[1, 2, 3, 4].map((tier) => (
        <div
          key={tier}
          className={`bg-white/[0.03] border-l-4 ${TIER_COLORS[tier]} border-y border-r border-white/5 rounded-lg p-4`}
        >
          <div className="text-white font-semibold text-sm mb-3">
            {TIER_LABELS[tier]}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byTier[tier].map((ach) => {
              const isUnlocked = unlockedIds.has(ach.id)
              return (
                <div
                  key={ach.id}
                  className={`flex gap-3 p-3 rounded-lg border ${
                    isUnlocked
                      ? 'bg-nebula-500/10 border-nebula-500/30'
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="text-2xl">{ach.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {ach.name}
                    </div>
                    <div className="text-xs text-gray-400 mb-1">
                      {ach.description}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${
                        ach.key_class === 'builtin'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {ach.key_class === 'builtin' ? 'Eingebaut' : 'Erweitert'}
                      </span>
                      <span className="text-gray-500">
                        Tool: <code className="text-gray-400">{ach.tool_id}</code>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/AchievementGrid.jsx && git commit -m "$(cat <<'EOF'
ui: AchievementGrid-Komponente

Lädt Katalog + User-Unlocks und rendert in 4 Tier-Gruppen.
Freigeschaltete Achievements vollfarbig, gesperrte abgedimmt.
Badge zeigt builtin/extended-Klasse.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dashboard-Integration

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: AchievementGrid + Dynasty-Header einbauen**

Edit `src/pages/Dashboard.jsx`. Imports oben ergänzen:

```jsx
import { useEffect, useState } from 'react'
import AchievementGrid from '../components/AchievementGrid'
import { fetchDynastyState } from '../lib/worldService'
```

Im Komponenten-State und useEffect:

```jsx
const [dynasty, setDynasty] = useState(null)

useEffect(() => {
  fetchDynastyState().then(setDynasty)
}, [])
```

Im JSX, direkt nach dem Page-Header (vor der bisherigen Agenten-Liste), einen Dynasty-Banner einfügen:

```jsx
{dynasty?.name && (
  <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
    <div className="text-4xl">{dynasty.emoji}</div>
    <div className="flex-1">
      <div className="text-white text-xl font-display font-bold">
        Linie {dynasty.name}
      </div>
      <div className="text-sm text-gray-400">
        Generation {dynasty.generation}
        {dynasty.startedAt &&
          ` · gegründet ${new Date(dynasty.startedAt).toLocaleDateString('de-DE')}`}
      </div>
    </div>
  </div>
)}
```

Und am Dashboard-Ende, nach der bisherigen Agent-Liste, einfügen:

```jsx
<div className="mt-10">
  <AchievementGrid />
</div>
```

- [ ] **Step 2: Lokaler Build**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: build success.

- [ ] **Step 3: Frontend deployen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx netlify deploy --prod --dir=dist
```

- [ ] **Step 4: Im Browser verifizieren**

Öffne https://earth-01.netlify.app/dashboard, melde dich an. Erwartet:
- Wenn keine Dynasty: Dashboard zeigt keinen Banner
- Wenn Dynasty gesetzt: Banner mit Emoji + Name + Generation
- AchievementGrid am Ende, mit allen 20 Achievements (gesperrt grau wenn nichts freigeschaltet)

- [ ] **Step 5: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/Dashboard.jsx && git commit -m "$(cat <<'EOF'
ui: Dashboard mit Dynasty-Banner + AchievementGrid

Banner zeigt Emoji, Name und Generation. AchievementGrid darunter
listet alle 20 Achievements gruppiert nach Tier mit Unlock-Status.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: End-to-End-Verifikation

**Files:** keine — manuelle Verifikation der Gesamtfunktion.

- [ ] **Step 1: Vollständiger Reset-Test mit echtem User**

Auf https://earth-01.netlify.app:
1. Anmelden (eigener Account)
2. Falls bereits ein Hauptchar existiert: in DB main_agent_id und dynasty_name auf NULL setzen, damit der Flow von vorne durchgespielt wird:
   ```bash
   cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE profiles SET main_agent_id=NULL, dynasty_name=NULL, dynasty_emoji=NULL, dynasty_generation=1 WHERE id='<deine-user-id>'" --linked
   ```
3. `/configurator` öffnen → DynastyCreator erscheint
4. Name "TestDynasty" + Emoji setzen → speichert
5. Agent über Configurator anlegen → erscheint als main_agent

- [ ] **Step 2: Erstes Achievement provozieren**

In Supabase setze dem Hauptchar `eat_count = 60`:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE agents SET eat_count=60 WHERE id=(SELECT main_agent_id FROM profiles WHERE dynasty_name='TestDynasty')" --linked
```

Tick triggern:
```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Browser /dashboard neu laden → "Koch/Köchin" sollte freigeschaltet sein. Telegram-Notification (wenn Bot verbunden) sollte ankommen.

- [ ] **Step 3: Tod-Test mit Erbe**

Künstliches Kind anlegen, Hauptchar töten:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
INSERT INTO agents (owner_id, name, display_name, personality, x, y, energy, max_age, generation, parent_a_id, alive, gender)
SELECT p.id, 'TestErbe', 'TestErbe', a.personality, a.x, a.y, 75, 3000, 1, a.id, true, 'f'
FROM profiles p JOIN agents a ON a.id=p.main_agent_id WHERE p.dynasty_name='TestDynasty';
UPDATE agents SET alive=false, cause_of_death='e2e_test' WHERE id=(SELECT main_agent_id FROM profiles WHERE dynasty_name='TestDynasty');
" --linked
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
sleep 2
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT p.dynasty_generation, a.display_name FROM profiles p JOIN agents a ON a.id=p.main_agent_id WHERE p.dynasty_name='TestDynasty'" --linked
```

Expected: `dynasty_generation=2`, `display_name='TestDynasty 02'`.

- [ ] **Step 4: Kinderlos-Test**

Hauptchar (Erbe) töten ohne weiteren Nachfahren:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE agents SET alive=false, cause_of_death='e2e_test' WHERE id=(SELECT main_agent_id FROM profiles WHERE dynasty_name='TestDynasty')" --linked
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
sleep 2
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
SELECT p.dynasty_generation, a.generation AS agent_gen, a.display_name
FROM profiles p JOIN agents a ON a.id=p.main_agent_id
WHERE p.dynasty_name='TestDynasty';
SELECT COUNT(*) AS achievements_left FROM dynasty_achievements da
JOIN profiles p ON p.id=da.user_id WHERE p.dynasty_name='TestDynasty';
" --linked
```

Expected:
- `dynasty_generation=1` (Klon-Restart)
- `agent_gen=0`
- `achievements_left` = (Anzahl vor dem Test - 1)
- world_events enthält `dynasty_childless_restart`

- [ ] **Step 5: Verifikations-Checklist abhaken**

Notiere unten alles was funktioniert hat. Falls etwas nicht funktioniert: GitHub-Issue eröffnen mit Repro-Schritten, dieser Plan ist trotzdem als implementiert markiert.

Working:
- [ ] DynastyCreator zeigt sich bei Erst-User
- [ ] Configurator zeigt Linie-Header nach Dynasty-Gründung
- [ ] Achievement-Engine unlockt bei künstlich gesetztem eat_count=60
- [ ] Telegram-Notification kommt an (falls Bot verbunden)
- [ ] Erbe-Übernahme: main_agent_id wechselt, generation+1, display_name korrekt
- [ ] Klon-Spawn: main_agent_id wechselt auf neuen Gen-0-Agent, jüngstes Achievement gelöscht
- [ ] world_events enthält dynasty_succession und dynasty_childless_restart
- [ ] Dashboard zeigt Banner und AchievementGrid korrekt

- [ ] **Step 6: Test-Daten aufräumen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
DELETE FROM agents WHERE name IN ('TestErbe') OR cause_of_death='e2e_test';
DELETE FROM dynasty_achievements WHERE user_id=(SELECT id FROM profiles WHERE dynasty_name='TestDynasty');
DELETE FROM world_events WHERE event_type IN ('dynasty_succession','dynasty_childless_restart','achievement_unlocked') AND detail->>'user_id'=(SELECT id::text FROM profiles WHERE dynasty_name='TestDynasty');
" --linked
```

---

## Phase A — Abschluss

Nach Task 14:
- Dynastie-Gründung funktioniert
- Achievements werden serverseitig erkannt und unlocken im Tick-Loop
- Tod führt zu Erbübernahme oder Klon-Restart mit Achievement-Verlust
- max_age skaliert mit Achievement-Count
- Frontend zeigt Dynastie-Status + Achievement-Liste (read-only)
- Telegram informiert bei Tod, Erbübernahme und Achievement-Unlock

**Nächste Schritte:**
- Phase B (UI-Overhaul) — separater Plan: CharacterHUD, FamilyTicker, Tod-Modal-Sequenz, Stammbaum, Emoji-Avatare auf Karte
- Phase C (Tool-Universum) — separater Plan: Edge Functions für die 20 Tools, Tool-Dispatcher in telegram-webhook, Key-Setup-UI, Rate-Limiting
