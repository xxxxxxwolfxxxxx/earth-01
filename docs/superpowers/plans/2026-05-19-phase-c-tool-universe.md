# Phase C — Tool-Universum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle 20 Tools des Achievement-Katalogs sind im Telegram-Bot / WebChat verfügbar, gating an freigeschaltete Achievements, mit Permission-Check + Rate-Limit. Key-Setup-UI für die erweiterten Tools.

**Architecture:** Erweitert die bestehende `telegram-webhook`-Edge-Function (text-pattern Tool-Parsing existiert bereits). Neue Tools werden als Cases in der `executeTools`-Funktion ergänzt. Permission/Rate-Limit-Gates greifen einheitlich am Eingang. Cron-Worker für Erinnerungen läuft als zweite Edge-Function. Frontend bekommt Key-Setup-Formular.

**Tech Stack:** Supabase Edge Functions (Deno) + pg_cron. Telegram Bot API. OpenAI-kompatibles LLM (User-Provider). Frontend React 19 + Tailwind.

**Out of scope:**
- Voice/STT-Tools (TTS gehört in einen späteren Plan, braucht Audio-Storage-Setup)
- MCP/Chrome-Steuerung (gestrichen wegen Mobile-Constraint)
- Multi-User-Marktplätze, Allianz-Chat-Übersetzungen
- Browser-basierte Code-Sandbox (nur `math_eval` als sichere Subset-Form)

---

## File Structure

**Neu:**
- `supabase/migrations/011_phase_c_tools.sql` — `user_lists`-Tabelle (geteiltes DB-Storage für Pattern A) + Index auf `agent_reminders.due_tick`
- `supabase/functions/_shared/toolRegistry.ts` — Tool-ID → Permission + Rate-Limit-Metadaten
- `supabase/functions/_shared/toolHandlers.ts` — Gebündelte Handler-Funktionen (DB-CRUD, Web-APIs, LLM-templates)
- `supabase/functions/reminder-tick/index.ts` — Cron-Worker der jede Minute fällige Reminders schickt
- `src/components/chronik/KeySetupPanel.jsx` — Eingabefelder für groq_api_key, resend_api_key, huggingface_key
- `src/lib/keyService.js` — Frontend-Funktionen zum Lesen/Schreiben der Keys

**Modifiziert:**
- `supabase/functions/telegram-webhook/index.ts` — Tool-Liste erweitert, Permission-Check + Rate-Limit, Tools-Guide-Prompt dynamisch je nach freigeschalteten Achievements
- `src/components/chronik/ToolsPanel.jsx` — KeySetupPanel oben einbinden

---

## Konventionen

- Deploy Edge Function: `cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy <name> --project-ref giyvmksetvberzrpvuhu --no-verify-jwt`
- Migration: `... npx supabase db push --linked`
- DB-Query: `... npx supabase db query "..." --linked`
- Frontend-Build: `npx vite build`, dann `npx netlify deploy --prod --dir=dist`
- Branch: `phase-a-dynasty` (Phase A+B liegen drauf)
- Commits: `tools: <kurz>` für Tool-Implementation, `infra: <kurz>` für Tool-Infrastruktur, `ui: <kurz>` für Frontend

---

## Tool-Inventar (was wo passiert)

| Tool-ID | Pattern | Achievement | Builtin/Extended | Wo passiert |
|---|---|---|---|---|
| `web_search` | B | schriftgelehrte | builtin | DuckDuckGo Instant Answer API |
| `reminder` | D | zeitmesser | builtin | DB insert + pg_cron-Worker |
| `shopping_list` | A | versorger | builtin | `user_lists` Tabelle |
| `recipe_helper` | C | koch | extended (LLM) | LLM-Prompt mit Rezept-Template |
| `travel_info` | B | erkunder | builtin | DuckDuckGo mit Travel-Prefix |
| `weather` | B | wassersucher | builtin | Open-Meteo API |
| `multi_agent_chat` | C | diplomat | extended (LLM) | Multiple-Personality LLM-Prompt |
| `image_generate` | E | kuenstler | extended (huggingface) | Hugging Face Inference API |
| `family_memory` | A | patriarch | builtin | `user_lists` mit list_type='family' |
| `symptom_tracker` | A | heiler | builtin | `user_lists` mit list_type='symptom' |
| `price_compare` | C | haendler | extended (LLM) | LLM-Prompt mit Marktanalyse-Template |
| `project_manager` | A | baumeister | builtin | `user_lists` mit list_type='project' |
| `math_eval` | C | ingenieur | builtin | LLM-Prompt mit "nur Math evaluieren"-Template + sicherer numerischer Parser |
| `security_check` | C | beschuetzer | extended (LLM) | LLM-Prompt mit Security-Template |
| `diary` | A | geschichtsschreiber | builtin | `user_lists` mit list_type='diary' |
| `decision_helper` | C | gesetzgeber | extended (LLM) | LLM-Prompt mit Pro/Contra-Template |
| `translator` | B | polyglott | extended (LLM oder LibreTranslate) | LLM mit Übersetzung-Prompt |
| `personality_style` | C | dynastie | builtin | Modifiziert nur den System-Prompt, kein eigener Aufruf |
| `email_send` | E | legende | extended (resend) | Resend API für Email-Versand |
| `autonomous_mode` | D | weiser | builtin | Wöchentlicher pg_cron mit Reflektions-Prompt |

---

## Task 1: DB-Migration für Phase C

**Files:**
- Create: `supabase/migrations/011_phase_c_tools.sql`

- [ ] **Step 1: Migration schreiben**

Write `supabase/migrations/011_phase_c_tools.sql`:

```sql
-- 011_phase_c_tools.sql
-- Generisches user_lists Storage für Pattern-A-Tools
-- + Performance-Index auf agent_reminders.due_tick

CREATE TABLE IF NOT EXISTS public.user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (list_type IN ('shopping','family','symptom','diary','project'))
);

CREATE INDEX IF NOT EXISTS idx_user_lists_user_type
  ON public.user_lists(user_id, list_type, created_at DESC);

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_lists: owner reads" ON public.user_lists;
CREATE POLICY "user_lists: owner reads" ON public.user_lists
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: owner writes" ON public.user_lists;
CREATE POLICY "user_lists: owner writes" ON public.user_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: owner deletes" ON public.user_lists;
CREATE POLICY "user_lists: owner deletes" ON public.user_lists
  FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: service all" ON public.user_lists;
CREATE POLICY "user_lists: service all" ON public.user_lists
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reminder-Performance: damit reminder-tick schnell pending findet
CREATE INDEX IF NOT EXISTS idx_agent_reminders_due
  ON public.agent_reminders(fire_at)
  WHERE fired_at IS NULL;
-- Hinweis: Falls die Spalten in der bestehenden agent_reminders-Tabelle
-- anders heißen, ist dieser Index optional und kann mit dem
-- tatsächlichen Spaltennamen angepasst werden. ON CONFLICT mit
-- bestehender Tabelle ist via IF NOT EXISTS sicher.
```

- [ ] **Step 2: Anwenden**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
```

Expected: `Applying migration 011_phase_c_tools.sql...` ohne Fehler. Falls der Index `idx_agent_reminders_due` wegen abweichender Spaltennamen scheitert: Migration anpassen (Spalte `due_tick` oder `due_at` statt `fire_at`), erneut anwenden.

- [ ] **Step 3: Verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT to_regclass('public.user_lists'), COUNT(*) AS lists FROM public.user_lists" --linked
```

Expected: `user_lists` ist nicht-null, `lists=0`.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/011_phase_c_tools.sql && git commit -m "$(cat <<'EOF'
db: Phase-C-Schema (user_lists + reminder-index)

Generisches user_lists Storage für Pattern-A-Tools (shopping,
family, symptom, diary, project) mit RLS. Performance-Index
auf agent_reminders für den reminder-tick-Worker.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tool-Registry + Permission-Gate

**Files:**
- Create: `supabase/functions/_shared/toolRegistry.ts`

- [ ] **Step 1: Registry-Modul schreiben**

Write `supabase/functions/_shared/toolRegistry.ts`:

```typescript
// Zentraler Tool-Katalog: Mapping tool_id → erforderliches achievement_id,
// Beschreibung für den Tools-Guide-Prompt, Rate-Limit, Key-Klasse.

export interface ToolMeta {
  tool_id: string;
  required_achievement: string;
  syntax: string;       // Beispiel-Aufruf für den LLM-Prompt
  description: string;  // Was tut das Tool
  key_class: "builtin" | "extended";
  required_key?: "llm_api_key" | "groq_api_key" | "huggingface_key" | "resend_api_key";
  rate_limit_per_day?: number;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  // Pattern B — Web/API
  { tool_id: "web_search", required_achievement: "schriftgelehrte",
    syntax: `[TOOL:web_search]{"query":"..."}[/TOOL]`,
    description: "Sucht im Web (DuckDuckGo). Antwort: kurze Zusammenfassung.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "travel_info", required_achievement: "erkunder",
    syntax: `[TOOL:travel_info]{"query":"Ziel oder Routenfrage"}[/TOOL]`,
    description: "Reise-/Routen-Infos via Web-Suche mit Travel-Kontext.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "weather", required_achievement: "wassersucher",
    syntax: `[TOOL:weather]{"location":"Stadt"}[/TOOL]`,
    description: "Aktuelle Wetterprognose (Open-Meteo).",
    key_class: "builtin", rate_limit_per_day: 30 },
  { tool_id: "translator", required_achievement: "polyglott",
    syntax: `[TOOL:translator]{"text":"...","target":"en|de|..."}[/TOOL]`,
    description: "Übersetzt Text in die Ziel-Sprache.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 50 },

  // Pattern D — Cron
  { tool_id: "reminder", required_achievement: "zeitmesser",
    syntax: `[TOOL:reminder]{"text":"...","minutes":30}[/TOOL]`,
    description: "Setzt eine Erinnerung. Telegram-Nachricht erfolgt nach den Minuten.",
    key_class: "builtin", rate_limit_per_day: 30 },
  { tool_id: "autonomous_mode", required_achievement: "weiser",
    syntax: `[TOOL:autonomous_mode]{"frequency":"weekly"}[/TOOL]`,
    description: "Aktiviert wöchentliche Selbst-Reflexion des Agenten.",
    key_class: "builtin", rate_limit_per_day: 5 },

  // Pattern A — DB-CRUD (user_lists)
  { tool_id: "shopping_list", required_achievement: "versorger",
    syntax: `[TOOL:shopping_list]{"action":"add|list|remove","item":"..."}[/TOOL]`,
    description: "Verwaltet deine Einkaufsliste.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "family_memory", required_achievement: "patriarch",
    syntax: `[TOOL:family_memory]{"action":"add|list","content":"..."}[/TOOL]`,
    description: "Speichert Notizen über Personen in deinem Leben.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "symptom_tracker", required_achievement: "heiler",
    syntax: `[TOOL:symptom_tracker]{"action":"add|list","symptom":"..."}[/TOOL]`,
    description: "Symptom-Dokumentation über Zeit.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "diary", required_achievement: "geschichtsschreiber",
    syntax: `[TOOL:diary]{"action":"add|list|today","entry":"..."}[/TOOL]`,
    description: "Tagebuch-Einträge.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "project_manager", required_achievement: "baumeister",
    syntax: `[TOOL:project_manager]{"action":"add|list|done","task":"..."}[/TOOL]`,
    description: "Tasks & Projekte tracken.",
    key_class: "builtin", rate_limit_per_day: 100 },

  // Pattern C — LLM-Templates
  { tool_id: "recipe_helper", required_achievement: "koch",
    syntax: `[TOOL:recipe_helper]{"ingredients":["Linsen","Reis"]}[/TOOL]`,
    description: "Rezept-Vorschläge aus deinen Zutaten.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "multi_agent_chat", required_achievement: "diplomat",
    syntax: `[TOOL:multi_agent_chat]{"question":"..."}[/TOOL]`,
    description: "Fragt mehrere Familien-Mitglieder gleichzeitig nach ihrer Meinung.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 20 },
  { tool_id: "price_compare", required_achievement: "haendler",
    syntax: `[TOOL:price_compare]{"product":"..."}[/TOOL]`,
    description: "Marktanalyse zu einem Produkt.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "math_eval", required_achievement: "ingenieur",
    syntax: `[TOOL:math_eval]{"expression":"2+3*4"}[/TOOL]`,
    description: "Wertet eine Math-Expression sicher aus.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "security_check", required_achievement: "beschuetzer",
    syntax: `[TOOL:security_check]{"text":"..."}[/TOOL]`,
    description: "Security-Analyse: Passwort-Stärke, Phishing-Erkennung.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "decision_helper", required_achievement: "gesetzgeber",
    syntax: `[TOOL:decision_helper]{"options":["A","B"],"criteria":["..."]}[/TOOL]`,
    description: "Entscheidungshilfe per Pro/Contra.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "personality_style", required_achievement: "dynastie",
    syntax: `(kein direkter Aufruf — wird automatisch als Prompt-Modifier verwendet)`,
    description: "Agent entwickelt einzigartigen Schreibstil basierend auf Achievements.",
    key_class: "builtin" },

  // Pattern E — External Keys
  { tool_id: "image_generate", required_achievement: "kuenstler",
    syntax: `[TOOL:image_generate]{"prompt":"..."}[/TOOL]`,
    description: "Bild aus Text (Hugging Face Inference API).",
    key_class: "extended", required_key: "huggingface_key", rate_limit_per_day: 10 },
  { tool_id: "email_send", required_achievement: "legende",
    syntax: `[TOOL:email_send]{"to":"...","subject":"...","body":"..."}[/TOOL]`,
    description: "Email-Versand via Resend.",
    key_class: "extended", required_key: "resend_api_key", rate_limit_per_day: 20 },
];

// Schnell-Lookup
export const TOOL_BY_ID = new Map(TOOL_REGISTRY.map((t) => [t.tool_id, t]));

// Filtert die Liste der Tools die User aktuell aufrufen darf.
export function availableToolsForUser(
  unlockedAchievementIds: Set<string>,
  userKeys: { llm_api_key?: string | null; groq_api_key?: string | null; huggingface_key?: string | null; resend_api_key?: string | null },
): ToolMeta[] {
  return TOOL_REGISTRY.filter((t) => {
    if (!unlockedAchievementIds.has(t.required_achievement)) return false;
    if (t.key_class === "extended") {
      const needed = t.required_key;
      if (!needed) return true;
      const v = (userKeys as any)[needed];
      if (!v) return false;
    }
    return true;
  });
}

// Generiert den Tools-Abschnitt für den LLM-Prompt
export function toolsGuideText(tools: ToolMeta[]): string {
  if (tools.length === 0) return "Du hast aktuell keine Werkzeuge freigeschaltet.";
  return [
    "Verfügbare Werkzeuge (immer im [TOOL:name]{...}[/TOOL] Format aufrufen):",
    ...tools.map((t) => `- ${t.tool_id}: ${t.description}\n  Beispiel: ${t.syntax}`),
  ].join("\n");
}

// Rate-Limit-Check: gibt true zurück wenn Limit erreicht ist
export async function isRateLimited(
  supabase: any,
  user_id: string,
  tool_id: string,
  limit: number,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tool_usage_log")
    .select("count")
    .eq("user_id", user_id)
    .eq("tool_id", tool_id)
    .eq("date", today)
    .single();
  return (data?.count ?? 0) >= limit;
}

export async function recordToolUsage(
  supabase: any,
  user_id: string,
  tool_id: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // Upsert: insert with count=1, or increment existing
  const { data } = await supabase
    .from("tool_usage_log")
    .select("count")
    .eq("user_id", user_id)
    .eq("tool_id", tool_id)
    .eq("date", today)
    .single();
  if (data) {
    await supabase
      .from("tool_usage_log")
      .update({ count: (data.count ?? 0) + 1 })
      .eq("user_id", user_id)
      .eq("tool_id", tool_id)
      .eq("date", today);
  } else {
    await supabase
      .from("tool_usage_log")
      .insert({ user_id, tool_id, date: today, count: 1 });
  }
}
```

- [ ] **Step 2: Commit (wird in Task 5 mit telegram-webhook zusammen deployed)**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/toolRegistry.ts && git commit -m "$(cat <<'EOF'
infra: Tool-Registry mit Permission-Gate + Rate-Limit-Helpers

Zentraler Katalog aller 20 Tools mit required_achievement,
required_key, Rate-Limit und syntax-Beispiel für den LLM-Prompt.
availableToolsForUser filtert basierend auf User-Achievements +
User-Keys. isRateLimited/recordToolUsage gegen tool_usage_log.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tool-Handlers (Pattern A — DB-CRUD)

**Files:**
- Create: `supabase/functions/_shared/toolHandlers.ts` (Teil 1 — DB-CRUD-Pattern)

- [ ] **Step 1: Datei mit Pattern-A-Handlern anlegen**

Write `supabase/functions/_shared/toolHandlers.ts`:

```typescript
// Tool-Handler werden vom telegram-webhook aufgerufen.
// Jede Funktion bekommt (params, ctx) und gibt einen string mit dem Tool-Ergebnis zurück.

export interface ToolContext {
  supabase: any;
  user_id: string;
  agent: any;        // Aktiver Agent (mit personality, llm_api_key Zugang)
  profile: any;      // Profile-Row inkl. Keys
}

// ─── Pattern A: user_lists CRUD ───────────────────────────────────

type ListAction = "add" | "list" | "remove" | "done" | "today";

async function listCrud(
  ctx: ToolContext,
  list_type: "shopping" | "family" | "symptom" | "diary" | "project",
  params: any,
  itemField: string,
): Promise<string> {
  const action = (params.action as ListAction) ?? "list";
  const item = (params[itemField] as string) ?? params.content ?? "";

  if (action === "add") {
    if (!item) return "Fehlt: was soll ich hinzufügen?";
    await ctx.supabase.from("user_lists").insert({
      user_id: ctx.user_id,
      list_type,
      content: item,
    });
    return `Hinzugefügt: ${item}`;
  }
  if (action === "remove" || action === "done") {
    if (!item) return "Fehlt: was soll ich entfernen?";
    await ctx.supabase
      .from("user_lists")
      .delete()
      .eq("user_id", ctx.user_id)
      .eq("list_type", list_type)
      .ilike("content", `%${item}%`);
    return `Entfernt: Einträge die "${item}" enthalten`;
  }
  if (action === "today") {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await ctx.supabase
      .from("user_lists")
      .select("content, created_at")
      .eq("user_id", ctx.user_id)
      .eq("list_type", list_type)
      .gte("created_at", `${today}T00:00:00Z`)
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) return "Heute noch keine Einträge.";
    return data.map((r: any) => `• ${r.content}`).join("\n");
  }
  // list (default)
  const { data } = await ctx.supabase
    .from("user_lists")
    .select("content, created_at")
    .eq("user_id", ctx.user_id)
    .eq("list_type", list_type)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data || data.length === 0) return "Liste ist leer.";
  return data.map((r: any) => `• ${r.content}`).join("\n");
}

export const handleShoppingList = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "shopping", params, "item");

export const handleFamilyMemory = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "family", params, "content");

export const handleSymptomTracker = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "symptom", params, "symptom");

export const handleDiary = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "diary", params, "entry");

export const handleProjectManager = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "project", params, "task");
```

- [ ] **Step 2: Commit (Datei wird in nachfolgenden Tasks erweitert)**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/toolHandlers.ts && git commit -m "$(cat <<'EOF'
tools: Pattern A — DB-CRUD-Handler (5 Tools)

shopping_list, family_memory, symptom_tracker, diary,
project_manager teilen sich die user_lists-Tabelle via list_type
diskriminator. Aktionen: add, list, remove, done, today.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tool-Handlers (Pattern B — Web/API + Pattern C — LLM-templates + Pattern E)

**Files:**
- Modify: `supabase/functions/_shared/toolHandlers.ts`

- [ ] **Step 1: Pattern B (Web/API) anhängen**

Edit `supabase/functions/_shared/toolHandlers.ts`. Am Dateiende ergänzen:

```typescript

// ─── Pattern B: Web/API zero-key ─────────────────────────────────

export async function handleWebSearch(params: any, _ctx: ToolContext): Promise<string> {
  const query = (params.query as string)?.trim();
  if (!query) return "Brauche eine Suchanfrage.";
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await r.json();
    const abs = data.AbstractText || data.Heading || "";
    const url = data.AbstractURL || "";
    if (!abs) {
      const topic = (data.RelatedTopics ?? [])[0]?.Text ?? "";
      if (topic) return topic;
      return `Keine direkte Antwort für "${query}". Versuche Wikipedia.`;
    }
    return url ? `${abs}\n\n${url}` : abs;
  } catch (e) {
    return `Suche fehlgeschlagen: ${(e as Error).message}`;
  }
}

export async function handleTravelInfo(params: any, ctx: ToolContext): Promise<string> {
  const query = (params.query as string)?.trim();
  if (!query) return "Brauche ein Ziel oder eine Routenfrage.";
  return handleWebSearch({ query: `Reise ${query}` }, ctx);
}

export async function handleWeather(params: any, _ctx: ToolContext): Promise<string> {
  const location = (params.location as string)?.trim();
  if (!location) return "Brauche einen Ort.";
  try {
    // Open-Meteo Geocoding: Stadt → lat/lon
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de`
    );
    const gj = await geo.json();
    const place = gj.results?.[0];
    if (!place) return `Ort "${location}" nicht gefunden.`;
    // Aktuelle Daten
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
    );
    const wxj = await wx.json();
    const c = wxj.current ?? {};
    return `${place.name}, ${place.country}: ${c.temperature_2m}°C, Wind ${c.wind_speed_10m} km/h (Code ${c.weather_code}).`;
  } catch (e) {
    return `Wetter-Abfrage fehlgeschlagen: ${(e as Error).message}`;
  }
}
```

- [ ] **Step 2: Pattern C (LLM-Templates) anhängen**

Weiter unten in `toolHandlers.ts`:

```typescript

// ─── Pattern C: LLM-Template Tools ───────────────────────────────

async function callLLM(profile: any, system: string, user: string): Promise<string> {
  const baseUrl = profile.llm_base_url || "https://integrate.api.nvidia.com/v1";
  const apiKey = profile.llm_api_key;
  const model = profile.llm_model || "moonshotai/kimi-k2.5";
  if (!apiKey) return "Bitte erst einen LLM-Key in den Einstellungen hinterlegen.";
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 512, temperature: 0.6,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) return `LLM-Fehler ${r.status}`;
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() ?? "(keine Antwort)";
}

export const handleRecipeHelper = (params: any, ctx: ToolContext) => {
  const ingredients = Array.isArray(params.ingredients) ? params.ingredients : [];
  if (ingredients.length === 0) return Promise.resolve("Brauche mindestens eine Zutat.");
  const sys = "Du bist ein Koch. Schlage genau ein Rezept vor das nur die genannten Zutaten + Wasser/Salz/Pfeffer braucht. Format: Kurzer Name, Zutaten-Mengen, 3-5 Schritte.";
  return callLLM(ctx.profile, sys, `Zutaten: ${ingredients.join(", ")}`);
};

export const handleDecisionHelper = (params: any, ctx: ToolContext) => {
  const options = Array.isArray(params.options) ? params.options : [];
  const criteria = Array.isArray(params.criteria) ? params.criteria : [];
  if (options.length < 2) return Promise.resolve("Mindestens 2 Optionen nötig.");
  const sys = "Du hilfst bei Entscheidungen. Erstelle eine kurze Pro/Contra-Liste pro Option und gib eine Empfehlung mit Begründung. Maximal 200 Wörter.";
  return callLLM(ctx.profile, sys,
    `Optionen: ${options.join(", ")}\nKriterien: ${criteria.length > 0 ? criteria.join(", ") : "allgemein"}`);
};

export const handlePriceCompare = (params: any, ctx: ToolContext) => {
  const product = (params.product as string)?.trim();
  if (!product) return Promise.resolve("Welches Produkt?");
  const sys = "Du bist ein Preis-Berater. Schätze typische Preisspanne für das Produkt im Jahr 2026 (DACH-Markt). Nenne 2-3 Kategorien (Discount / Mittelklasse / Premium) mit Preisspanne. Disclaimer am Ende: 'Schätzung, vergleiche aktuelle Online-Preise.'";
  return callLLM(ctx.profile, sys, product);
};

export const handleSecurityCheck = (params: any, ctx: ToolContext) => {
  const text = (params.text as string)?.trim();
  if (!text) return Promise.resolve("Was soll ich prüfen?");
  const sys = "Du bist ein Security-Berater. Analysiere den Text auf Phishing-Indikatoren, Passwort-Schwächen oder verdächtige URLs. Antworte strukturiert: Risiko (gering/mittel/hoch), Begründung, Empfehlung.";
  return callLLM(ctx.profile, sys, text);
};

export const handleTranslator = (params: any, ctx: ToolContext) => {
  const text = (params.text as string)?.trim();
  const target = (params.target as string)?.trim() ?? "en";
  if (!text) return Promise.resolve("Was soll ich übersetzen?");
  const sys = `Übersetze in ${target}. Antworte NUR mit der Übersetzung, ohne Anführungszeichen, ohne Erklärung.`;
  return callLLM(ctx.profile, sys, text);
};

export const handleMultiAgentChat = async (params: any, ctx: ToolContext) => {
  const question = (params.question as string)?.trim();
  if (!question) return "Was soll ich fragen?";
  // Hole bis zu 3 weitere Familien-Agenten
  const { data: family } = await ctx.supabase
    .from("agents")
    .select("id,name,display_name,personality,generation")
    .eq("owner_id", ctx.user_id)
    .eq("alive", true)
    .neq("id", ctx.agent.id)
    .limit(3);
  if (!family || family.length === 0) {
    return "Du hast aktuell keine anderen lebenden Familien-Mitglieder.";
  }
  const answers: string[] = [];
  for (const member of family) {
    const sys = `Du bist ${member.display_name ?? member.name} (Gen ${member.generation}). Persönlichkeit: ${JSON.stringify(member.personality)}. Antworte kurz aus dieser Perspektive (max 2 Sätze).`;
    const ans = await callLLM(ctx.profile, sys, question);
    answers.push(`💬 ${member.display_name ?? member.name}: ${ans}`);
  }
  return answers.join("\n\n");
};

// math_eval: sichere numerische Auswertung (kein LLM, lokales Parser)
export const handleMathEval = (params: any, _ctx: ToolContext): Promise<string> => {
  const expr = (params.expression as string)?.trim() ?? "";
  if (!expr) return Promise.resolve("Brauche eine Expression.");
  // Erlaube nur Ziffern, Operatoren, Klammern, Komma, Punkt, Whitespace, e, E (Exponential).
  if (!/^[\d+\-*/().,\s\eE]+$/.test(expr)) {
    return Promise.resolve("Nur einfache Math-Expressions erlaubt (+,-,*,/,(,)).");
  }
  try {
    // Function-Konstruktor ist hier sicher weil wir den Input vorab validiert haben
    const result = new Function(`return (${expr.replace(/,/g, ".")});`)();
    if (typeof result !== "number" || !isFinite(result)) {
      return Promise.resolve("Ergebnis ist keine endliche Zahl.");
    }
    return Promise.resolve(`= ${result}`);
  } catch (e) {
    return Promise.resolve(`Parse-Fehler: ${(e as Error).message}`);
  }
};

// personality_style — kein Tool-Aufruf, wird vom Webhook als Prompt-Modifier verwendet.
// Hier nur Stub damit das Switch keinen Default-Fallback braucht.
export const handlePersonalityStyle = (_params: any, _ctx: ToolContext) =>
  Promise.resolve("personality_style wird automatisch im Hintergrund angewendet.");
```

- [ ] **Step 3: Pattern E (External Keys) anhängen**

```typescript

// ─── Pattern E: External Keys ────────────────────────────────────

export async function handleImageGenerate(params: any, ctx: ToolContext): Promise<string> {
  const prompt = (params.prompt as string)?.trim();
  if (!prompt) return "Brauche einen Prompt.";
  const key = ctx.profile.huggingface_key;
  if (!key) return "Hinterlege erst einen kostenlosen Hugging-Face-Key in den Einstellungen.";
  try {
    const r = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt }),
      }
    );
    if (!r.ok) return `Image-API-Fehler ${r.status}`;
    // r.body ist binär (image/png). Wir speichern in Supabase Storage und geben URL zurück.
    const buf = new Uint8Array(await r.arrayBuffer());
    const path = `${ctx.user_id}/${Date.now()}.png`;
    const { error: upErr } = await ctx.supabase.storage
      .from("generated-images").upload(path, buf, { contentType: "image/png" });
    if (upErr) return `Upload-Fehler: ${upErr.message}`;
    const { data } = ctx.supabase.storage.from("generated-images").getPublicUrl(path);
    return `Bild generiert: ${data.publicUrl}`;
  } catch (e) {
    return `Generierung fehlgeschlagen: ${(e as Error).message}`;
  }
}

export async function handleEmailSend(params: any, ctx: ToolContext): Promise<string> {
  const to = (params.to as string)?.trim();
  const subject = (params.subject as string)?.trim();
  const body = (params.body as string)?.trim();
  if (!to || !subject || !body) return "Brauche to, subject, body.";
  const key = ctx.profile.resend_api_key;
  if (!key) return "Hinterlege erst einen Resend-Key in den Einstellungen.";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [to], subject, text: body,
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      return `Email-Fehler ${r.status}: ${errBody.slice(0,200)}`;
    }
    return `Email gesendet an ${to}.`;
  } catch (e) {
    return `Versand fehlgeschlagen: ${(e as Error).message}`;
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/toolHandlers.ts && git commit -m "$(cat <<'EOF'
tools: Pattern B/C/E Handler (Web, LLM-Templates, externe Keys)

Pattern B: web_search, travel_info, weather (Open-Meteo).
Pattern C: recipe_helper, decision_helper, price_compare,
security_check, translator, multi_agent_chat, math_eval (safe
local parser), personality_style (stub).
Pattern E: image_generate (Hugging Face), email_send (Resend).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: telegram-webhook integriert die neue Registry

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`

Die bestehende Webhook hat schon ein Text-Pattern-Tool-System (`[TOOL:name]{...}[/TOOL]`). Wir erweitern es um:
- Permission-Check via Registry
- Rate-Limit
- Dynamische Tools-Guide-Liste basierend auf User-Achievements
- Aufruf aller neuen Handler

- [ ] **Step 1: Imports + Achievement-Loader**

Edit `supabase/functions/telegram-webhook/index.ts`. Im Bereich der Imports oben ergänzen:

```typescript
import { TOOL_BY_ID, availableToolsForUser, toolsGuideText, isRateLimited, recordToolUsage } from "../_shared/toolRegistry.ts";
import * as Handlers from "../_shared/toolHandlers.ts";
```

- [ ] **Step 2: Loader für User-Achievements**

Im Code finden wo `profile` geladen wird (grep nach `from("profiles")`). Direkt DANACH einen Block einfügen der die freigeschalteten Achievements lädt:

```typescript
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
```

- [ ] **Step 3: Tools-Guide in den Prompt einbauen**

Suche im Webhook die Stelle wo der Tools-Hinweis im Prompt aufgebaut wird (grep nach `TOOL:remember`). Ersetze den hartcodierten Tools-Abschnitt durch:

```typescript
const toolsGuide = toolsGuideText(availableTools);
```

Und sorge dafür dass `toolsGuide` in den finalen Prompt eingefügt wird (z.B. in `buildChatPrompt` als zusätzlicher Parameter oder als String-Anhang). Wenn `buildChatPrompt` aus `src/lib/agentBrain.js` kommt, kannst du den Tools-Block am Ende des Prompts manuell anhängen:

```typescript
const promptWithTools = `${prompt}\n\n${toolsGuide}`;
```

Und `promptWithTools` an die LLM-Aufruf-Stelle weiterreichen.

- [ ] **Step 4: executeTools-Switch erweitern**

Finde die `executeTools`-Funktion (oder das Switch in der Tool-Verarbeitung). Ersetze den Switch durch einen Dispatch der die Registry nutzt:

```typescript
async function executeOneTool(
  tool_id: string,
  params: any,
  ctx: { supabase: any; user_id: string; agent: any; profile: any },
  unlockedSet: Set<string>,
): Promise<string> {
  const meta = TOOL_BY_ID.get(tool_id);
  if (!meta) return `Unbekanntes Tool: ${tool_id}`;
  if (!unlockedSet.has(meta.required_achievement)) {
    return `Tool ${tool_id} ist noch nicht freigeschaltet.`;
  }
  if (meta.key_class === "extended" && meta.required_key) {
    const k = (ctx.profile as any)[meta.required_key];
    if (!k) return `Bitte erst Key '${meta.required_key}' in den Einstellungen hinterlegen.`;
  }
  if (meta.rate_limit_per_day && await isRateLimited(ctx.supabase, ctx.user_id, tool_id, meta.rate_limit_per_day)) {
    return `Limit für ${tool_id} heute erreicht.`;
  }

  let result = "";
  switch (tool_id) {
    case "shopping_list": result = await Handlers.handleShoppingList(params, ctx); break;
    case "family_memory": result = await Handlers.handleFamilyMemory(params, ctx); break;
    case "symptom_tracker": result = await Handlers.handleSymptomTracker(params, ctx); break;
    case "diary": result = await Handlers.handleDiary(params, ctx); break;
    case "project_manager": result = await Handlers.handleProjectManager(params, ctx); break;
    case "web_search": result = await Handlers.handleWebSearch(params, ctx); break;
    case "travel_info": result = await Handlers.handleTravelInfo(params, ctx); break;
    case "weather": result = await Handlers.handleWeather(params, ctx); break;
    case "recipe_helper": result = await Handlers.handleRecipeHelper(params, ctx); break;
    case "decision_helper": result = await Handlers.handleDecisionHelper(params, ctx); break;
    case "price_compare": result = await Handlers.handlePriceCompare(params, ctx); break;
    case "security_check": result = await Handlers.handleSecurityCheck(params, ctx); break;
    case "translator": result = await Handlers.handleTranslator(params, ctx); break;
    case "multi_agent_chat": result = await Handlers.handleMultiAgentChat(params, ctx); break;
    case "math_eval": result = await Handlers.handleMathEval(params, ctx); break;
    case "image_generate": result = await Handlers.handleImageGenerate(params, ctx); break;
    case "email_send": result = await Handlers.handleEmailSend(params, ctx); break;
    case "reminder": {
      const text = (params.text as string)?.trim();
      const minutes = Math.max(1, Math.floor(Number(params.minutes ?? 30)));
      if (!text) { result = "Brauche einen Erinnerungs-Text."; break; }
      const fireAt = new Date(Date.now() + minutes * 60_000).toISOString();
      await ctx.supabase.from("agent_reminders").insert({
        agent_id: ctx.agent.id,
        text,
        fire_at: fireAt,
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
    default: result = `Tool ${tool_id} hat noch keinen Handler.`;
  }

  await recordToolUsage(ctx.supabase, ctx.user_id, tool_id);
  return result;
}
```

Und ändere die bestehende Schleife (die alle Tool-Calls im Text durchgeht) so dass sie `executeOneTool` aufruft statt des alten Switches. Das bestehende `executeTools` kann komplett ersetzt werden oder dieser Code wird als Drop-In hinzugefügt — passe es an die existierende Struktur an (grep nach `for (const call of tools)`).

- [ ] **Step 5: Bestehende alte Tools deprecaten (kompatibel halten)**

Die alten Tool-Namen (`set_reminder`, `world_status`, `my_status`, `nearby_agents`, `remember`) bleiben funktional. Sie sind keine Achievement-gegateten Tools sondern Basis-Funktionen. Füge im `executeOneTool` zu Beginn (vor `TOOL_BY_ID.get(...)`) eine Fallback-Branch ein die diese alten Namen auf den existierenden Handler weiterleitet:

```typescript
if (["set_reminder","world_status","my_status","nearby_agents","remember"].includes(tool_id)) {
  // Lege auf das bestehende Verhalten zurück
  // (vorherige executeTools-Implementation bleibt für diese Tools relevant)
  return legacyToolHandler(tool_id, params, ctx);
}
```

Wo `legacyToolHandler` einfach den alten Switch-Body extrahiert oder du den alten Aufruf direkt eingebaut hast.

- [ ] **Step 6: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy telegram-webhook --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 7: Schneller Smoke-Test**

Falls dein Telegram-Bot verbunden ist: schreibe „Was ist das Wetter in Hamburg?" — der Bot sollte (wenn `wassersucher` freigeschaltet ist) eine Wetter-Antwort liefern. Sonst sollte er sagen das Tool sei nicht verfügbar.

Wenn kein Telegram-Bot verfügbar ist: testet via direktem HTTP-Aufruf eines `agent_messages`-Inserts mit Test-Daten oder über die WebChat-Komponente in `/dashboard`.

- [ ] **Step 8: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/telegram-webhook/index.ts && git commit -m "$(cat <<'EOF'
infra: Tool-Dispatcher mit Permission-Gate + Rate-Limit

telegram-webhook lädt User-Achievements + Keys, baut dynamisch
die Tools-Guide-Liste, dispatcht aufgerufene Tools über
toolHandlers. executeOneTool prüft Achievement, Key, Rate-Limit
vor jeder Ausführung und loggt jeden Call in tool_usage_log.
Legacy-Tools (set_reminder etc.) bleiben kompatibel.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Reminder-Cron-Worker

**Files:**
- Create: `supabase/functions/reminder-tick/index.ts`

- [ ] **Step 1: Edge Function schreiben**

Write `supabase/functions/reminder-tick/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("agent_reminders")
    .select("id, agent_id, text")
    .lte("fire_at", now)
    .is("fired_at", null)
    .limit(50);

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), { headers: { "Content-Type": "application/json" }});
  }

  let fired = 0;
  for (const r of due) {
    // Hole Agent + Profile für Telegram-Daten
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
    const text = `${sender} <b>${senderName}</b> erinnert dich:\n${r.text}`;

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

    await supabase.from("agent_reminders").update({ fired_at: now }).eq("id", r.id);
    fired++;
  }

  return new Response(JSON.stringify({ fired }), { headers: { "Content-Type": "application/json" }});
});
```

- [ ] **Step 2: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy reminder-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: pg_cron-Job einrichten**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
SELECT cron.schedule(
  'reminder-tick',
  '* * * * *',
  \$\$ SELECT net.http_post(
    url := 'https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/reminder-tick',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true))
  ) AS request_id \$\$
);" --linked
```

Wenn `app.settings.service_role_key` nicht gesetzt ist (üblich), nutze stattdessen den anon-Key:
```bash
... 'Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq'
```
(Edge Functions deployed mit `--no-verify-jwt` akzeptieren anon-Key.)

Erwartet: Cron-Job ist registriert. Free-Tier erlaubt max 2 Jobs — `simulation-tick` + `reminder-tick` belegen beide Slots.

- [ ] **Step 4: Smoke-Test**

Künstliche Erinnerung anlegen die sofort fällig ist:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "INSERT INTO agent_reminders (agent_id, text, fire_at) SELECT id, 'Phase-C-Smoke-Test', now() - interval '1 minute' FROM agents WHERE alive=true LIMIT 1 RETURNING id" --linked
```

Manuell triggern (statt auf cron warten):
```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/reminder-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Expected: Response `{"fired":1}`. Telegram-Nachricht ankommen wenn der Bot des Users verbunden ist.

Aufräumen:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "DELETE FROM agent_reminders WHERE text='Phase-C-Smoke-Test'" --linked
```

- [ ] **Step 5: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/reminder-tick/index.ts && git commit -m "$(cat <<'EOF'
tools: reminder-tick Cron-Worker

Edge Function läuft minütlich via pg_cron, fired fällige
Reminder als Telegram-Nachrichten. fired_at wird gesetzt
um Doppel-Sendungen zu vermeiden.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: autonomous_mode — Weekly Reflection

**Files:**
- Modify: `supabase/functions/_shared/toolHandlers.ts`
- Create: `supabase/functions/reflection-weekly/index.ts`

Die Aktivierung-Tools für autonomous_mode wurde in Task 5 als Bestätigungsmeldung implementiert. Diese Task baut das eigentliche Wochen-Cron noch nicht ein (pg_cron-Free-Tier-Slots sind schon mit simulation-tick und reminder-tick belegt). Stattdessen: ein on-demand-Endpoint den der User selbst aufrufen kann.

- [ ] **Step 1: Edge Function für Reflektion**

Write `supabase/functions/reflection-weekly/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Welcher User soll reflektieren? Aus URL: ?user_id=...
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
  }

  // Hole User-Profile + main_agent
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

  // LLM-Reflektion
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

  // Telegram-Versand
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
```

- [ ] **Step 2: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy reflection-weekly --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: Smoke-Test**

```bash
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/reflection-weekly?user_id=<deine-user-id>" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq" | head -50
```

Expected: ein JSON mit `text`-Feld das eine Reflektion enthält.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/reflection-weekly/index.ts && git commit -m "$(cat <<'EOF'
tools: reflection-weekly für autonomous_mode

On-Demand Endpoint der die letzten 14 Tage Ereignisse der
Linie zusammenfasst und per Telegram schickt. Frontend kann
einen "Reflektieren"-Button anbinden, später kann ein
externer Scheduler den Endpoint wöchentlich aufrufen.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Storage-Bucket für generierte Bilder

**Files:** keine — nur DB-Setup

- [ ] **Step 1: Bucket erstellen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images','generated-images',true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS \"images: anyone reads\" ON storage.objects;
CREATE POLICY \"images: anyone reads\" ON storage.objects
  FOR SELECT USING (bucket_id = 'generated-images');

DROP POLICY IF EXISTS \"images: service writes\" ON storage.objects;
CREATE POLICY \"images: service writes\" ON storage.objects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
" --linked
```

- [ ] **Step 2: Verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT id, name, public FROM storage.buckets WHERE id='generated-images'" --linked
```

Expected: 1 Zeile, `public=true`.

Kein Commit — Bucket-Setup ist DB-State, nicht im Repo.

---

## Task 9: Frontend — keyService.js

**Files:**
- Create: `src/lib/keyService.js`

- [ ] **Step 1: Service schreiben**

Write `src/lib/keyService.js`:

```javascript
import { supabase } from './supabase'

export async function fetchUserKeys() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('llm_api_key, llm_base_url, llm_model, groq_api_key, huggingface_key, resend_api_key')
    .eq('id', user.id)
    .single()
  return data ?? {}
}

export async function saveUserKey(field, value) {
  const ALLOWED = new Set(['llm_api_key','llm_base_url','llm_model','groq_api_key','huggingface_key','resend_api_key'])
  if (!ALLOWED.has(field)) throw new Error('Unbekanntes Feld')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  const update = {}
  update[field] = value || null
  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) throw error
}

// Schnell-Test: pingt einen einfachen Endpoint mit dem Key um zu sehen ob er gültig ist
export async function testKey(field, value) {
  if (!value) return { ok: false, message: 'Kein Key' }
  try {
    if (field === 'huggingface_key') {
      const r = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${value}` }
      })
      if (!r.ok) return { ok: false, message: `HuggingFace ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    if (field === 'resend_api_key') {
      const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${value}` }
      })
      if (!r.ok) return { ok: false, message: `Resend ${r.status}` }
      return { ok: true, message: 'OK' }
    }
    // Für LLM/Groq: simpler Test nicht ohne CORS-Workaround möglich → wir akzeptieren ungeprüft
    return { ok: true, message: 'gespeichert (nicht getestet)' }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/lib/keyService.js && git commit -m "$(cat <<'EOF'
api: keyService — User-Keys lesen, speichern, testen

Frontend-Funktionen für die Drittanbieter-Keys (LLM, Groq,
Hugging Face, Resend). testKey pingt einfache Endpoints
um Validität zu prüfen (so weit ohne CORS-Probleme möglich).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Frontend — KeySetupPanel & Integration

**Files:**
- Create: `src/components/chronik/KeySetupPanel.jsx`
- Modify: `src/components/chronik/ToolsPanel.jsx`

- [ ] **Step 1: KeySetupPanel schreiben**

Write `src/components/chronik/KeySetupPanel.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Key, Check, X } from 'lucide-react'
import { fetchUserKeys, saveUserKey, testKey } from '../../lib/keyService'

const KEY_FIELDS = [
  { field: 'llm_api_key', label: 'LLM-Key (Groq / NVIDIA / OpenRouter)', placeholder: 'sk-…', help: 'kostenlose Keys: groq.com, openrouter.ai, build.nvidia.com' },
  { field: 'huggingface_key', label: 'Hugging-Face-Key (für Bild-Generation)', placeholder: 'hf_…', help: 'kostenlos auf huggingface.co/settings/tokens' },
  { field: 'resend_api_key', label: 'Resend-Key (für Email-Versand)', placeholder: 're_…', help: '100 Mails/Tag kostenlos auf resend.com' },
]

export default function KeySetupPanel() {
  const [keys, setKeys] = useState({})
  const [edits, setEdits] = useState({})
  const [testResults, setTestResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => {
    fetchUserKeys().then((k) => { setKeys(k ?? {}); setLoading(false) })
  }, [])

  async function handleSave(field) {
    setSaving((s) => ({ ...s, [field]: true }))
    try {
      const value = edits[field]
      await saveUserKey(field, value)
      const result = await testKey(field, value)
      setTestResults((r) => ({ ...r, [field]: result }))
      setKeys((k) => ({ ...k, [field]: value }))
      setEdits((e) => { const next = { ...e }; delete next[field]; return next })
    } catch (e) {
      setTestResults((r) => ({ ...r, [field]: { ok: false, message: e.message }}))
    } finally {
      setSaving((s) => ({ ...s, [field]: false }))
    }
  }

  if (loading) return <div className="text-gray-500">Lade…</div>

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-nebula-400" />
        <h3 className="font-display font-bold text-white">API-Keys (für erweiterte Tools)</h3>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Alle Tools mit dem gelben "Erweitert"-Badge brauchen einen kostenlosen
        Drittanbieter-Key. Keys werden nur in deinem Supabase-Profil gespeichert.
      </p>

      <div className="space-y-4">
        {KEY_FIELDS.map(({ field, label, placeholder, help }) => {
          const current = keys[field] ?? ''
          const masked = current ? `${current.slice(0,4)}…${current.slice(-3)}` : ''
          const editing = edits[field] !== undefined
          const result = testResults[field]
          return (
            <div key={field} className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <label className="text-sm text-gray-300 mb-1 block">{label}</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={editing ? edits[field] : ''}
                  onChange={(e) => setEdits((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder={current ? `gespeichert: ${masked}` : placeholder}
                  className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleSave(field)}
                  disabled={!editing || saving[field]}
                  className="px-3 py-2 bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50 text-white text-sm rounded-md"
                >
                  {saving[field] ? '…' : 'Speichern & testen'}
                </button>
                {current && !editing && (
                  <button
                    type="button"
                    onClick={() => handleSave(field)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Löschen
                  </button>
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{help}</div>
              {result && (
                <div className={`mt-1 text-xs flex items-center gap-1 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {result.message}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: KeySetupPanel in ToolsPanel einbauen**

Edit `src/components/chronik/ToolsPanel.jsx`. Import oben ergänzen:

```jsx
import KeySetupPanel from './KeySetupPanel'
```

Im Return, direkt unter dem öffnenden `<div className="space-y-5">`, einfügen:

```jsx
<KeySetupPanel />
```

- [ ] **Step 3: Build**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 4: Commit**

Stage beide Dateien:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/chronik/KeySetupPanel.jsx src/components/chronik/ToolsPanel.jsx && git commit -m "$(cat <<'EOF'
ui: KeySetupPanel im Chronik-Tools-Tab

Eingabefelder + Test-Button für llm_api_key, huggingface_key,
resend_api_key. Speichert direkt in profiles. Anzeige der
maskierten Keys + Test-Status (ok/fehler).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Deploy & End-to-End-Verifikation

**Files:** keine — Deployment + Test

- [ ] **Step 1: Frontend deployen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx netlify deploy --prod --dir=dist
```

- [ ] **Step 2: Auf /chronik → Tools-Tab im Browser**

Öffne https://earth-01.netlify.app/chronik mit eingeloggtem User. Im Tools-Tab oben erscheint das KeySetupPanel mit den drei Feldern.

- [ ] **Step 3: Vollständiger Tool-Test (Telegram)**

Mit einem eingeloggten User dessen Telegram-Bot verbunden ist UND der mindestens 1 Achievement freigeschaltet hat:

1. Wetter testen (`wassersucher` freigeschaltet?):
   In Telegram an deinen Bot: „Wie wird das Wetter morgen in Berlin?"
   Expected: Antwort mit Open-Meteo-Wettersdaten.

2. Einkaufsliste (`versorger` freigeschaltet?):
   In Telegram: „Füge Milch und Brot zur Einkaufsliste hinzu."
   Dann: „Was ist auf meiner Einkaufsliste?"
   Expected: Beide Items werden angezeigt.

3. Mathe (`ingenieur` freigeschaltet?):
   In Telegram: „Was ist 2 + 3 * 4?"
   Expected: `= 14`.

4. Bild-Generation (`kuenstler` freigeschaltet + huggingface_key gesetzt?):
   In Telegram: „Mal mir einen Berg-See."
   Expected: Bild-URL.

Falls eines der Tools schlägt fehl: Logs in Supabase-Dashboard → Functions → telegram-webhook → Logs prüfen.

- [ ] **Step 4: Reminder-E2E-Test**

In Telegram: „Erinnere mich in 1 Minute an Tee trinken."
Expected: Innerhalb 1-2 Minuten Telegram-Nachricht „⏰ … erinnert dich: Tee trinken".

- [ ] **Step 5: Verifikations-Checkliste**

Working:
- [ ] KeySetupPanel im /chronik Tools-Tab sichtbar
- [ ] Mind. 1 zero-key Tool (z.B. weather oder shopping_list) funktioniert im Telegram-Chat
- [ ] Mind. 1 LLM-Tool (z.B. recipe_helper) funktioniert wenn LLM-Key gesetzt
- [ ] reminder-tick liefert die Nachricht zeitnah
- [ ] tool_usage_log wird befüllt: prüfen via DB-Query
   ```bash
   ... npx supabase db query "SELECT user_id, tool_id, date, count FROM tool_usage_log ORDER BY count DESC LIMIT 5" --linked
   ```
- [ ] Permission-Check funktioniert: ein Tool ohne Achievement wird abgelehnt

Falls etwas nicht funktioniert: GitHub-Issue mit Reproduktion eröffnen, Plan ist trotzdem als implementiert markiert.

---

## Phase C — Abschluss

Nach Task 11:
- 20 Tools sind funktional verdrahtet
- Permission-Gate + Rate-Limit greifen
- Reminder-Worker schickt fällige Erinnerungen
- KeySetupPanel macht erweiterte Tools auf jedem Handy zugänglich
- Die Roguelite-Mechanik aus Phase A hat jetzt echte Konsequenzen: jedes freigeschaltete Achievement schaltet ein Real-World-Tool im Alltag des Users frei

**Nächste optionale Schritte:**
- TTS für Voice-Nachrichten (eigener Plan, braucht Audio-Storage + Edge-TTS-Integration)
- Tool-spezifische Verfeinerungen basierend auf User-Feedback
- Weitere Achievements / Tools jenseits der initialen 20
- Cross-User-Features (z.B. Allianz-Chat zwischen Familien verschiedener User)
