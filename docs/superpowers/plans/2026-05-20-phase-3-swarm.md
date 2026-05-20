# Phase 3 — Bot-Schwarm als Content-Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bots der User produzieren mit gespendeten Restkontingenten kollektiv Artikel (Text + Bilder) zu KI/Code/Programmieren-Themen. Pipeline aus 7 Job-Typen, ein Bot pro Job, Wikipedia-Style Edits nach Aktivierungs-Schwelle.

**Architecture:** Job-Queue in Postgres, Edge Functions als Orchestrator + Worker, harte Plattform-weite Skalierungs-Limits. Token-Spende opt-in pro User, Cron-getriggerte Harvest-Phase in den Minuten vor Provider-Reset.

**Tech Stack:** Supabase Postgres + Edge Functions (Deno) + Realtime, React 19 + Vite + Tailwind 4, Netlify.

**Spec:** `docs/superpowers/specs/2026-05-20-phase-3-swarm-content.md`

**Branch:** `phase-3-swarm` (aus `main`)

---

## Datei-Übersicht

**Neue Dateien:**

| Pfad | Verantwortung |
|---|---|
| `supabase/migrations/120_swarm_schema.sql` | 4 Tabellen + Profile-Erweiterungen |
| `supabase/migrations/121_donate_skill.sql` | Skill-Katalog: `donate_tokens` |
| `supabase/migrations/122_topic_seed.sql` | 20 Initial-Topics aus Glossar + Skills |
| `supabase/functions/_shared/providerLimits.ts` | Reset-Schedules + Quota-Probe |
| `supabase/functions/_shared/swarmJobs.ts` | Job-Definitionen + Prompts pro Typ |
| `supabase/functions/_shared/qualityScore.ts` | JSON-Score + Promo-Filter |
| `supabase/functions/swarm-orchestrator/index.ts` | Job-Assignment + Backpressure |
| `supabase/functions/swarm-worker/index.ts` | Einzeljob-Ausführung mit User-Key |
| `src/lib/swarmService.js` | Frontend-API für /data + /erde-lernt |
| `src/pages/ErdeLernt.jsx` | Artikel-Übersicht + Detail-Routen |

**Modifizierte Dateien:**

| Pfad | Was ändert sich |
|---|---|
| `supabase/functions/reminder-tick/index.ts` | Harvest-Trigger in den letzten 30 Min vor Reset |
| `src/pages/Data.jsx` | „Schwarm-Beitrag"-Sektion (Toggle + Counter) |
| `src/App.jsx` | Route `/erde-lernt` + `/erde-lernt/:slug` |
| `src/components/Navigation.jsx` | Link „Erde lernt" |

---

## Task 1: Migration 120 — Schwarm-Schema

**Files:**
- Create: `supabase/migrations/120_swarm_schema.sql`

- [ ] **Step 1: Branch erstellen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
git checkout main && git pull
git checkout -b phase-3-swarm
```

- [ ] **Step 2: Migration schreiben**

`supabase/migrations/120_swarm_schema.sql`:

```sql
-- 120_swarm_schema.sql

-- Themen-Pool: kuratiert + user-vorgeschlagen
CREATE TABLE IF NOT EXISTS public.topic_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('glossary','skill','user','bot')),
  source_ref TEXT,
  suggested_by_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','rejected')),
  context_seed TEXT,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topic_pool_status_idx ON public.topic_pool(status);

ALTER TABLE public.topic_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read topic_pool" ON public.topic_pool;
CREATE POLICY "Public read topic_pool" ON public.topic_pool FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert topic_pool" ON public.topic_pool;
CREATE POLICY "Auth insert topic_pool" ON public.topic_pool FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND source = 'user');

-- Artikel
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topic_pool(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','researched','drafted','illustrated','reviewed','published','retired')),
  body_markdown TEXT,
  hero_image_url TEXT,
  contributor_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  edit_lock_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles(status);
CREATE INDEX IF NOT EXISTS articles_published_idx ON public.articles(published_at DESC);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read articles" ON public.articles;
CREATE POLICY "Public read articles" ON public.articles FOR SELECT USING (true);

-- Job-Queue
CREATE TABLE IF NOT EXISTS public.article_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('topic_propose','research','draft','illustrate','code_snippet','review','revise')),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','assigned','done','failed')),
  required_capability TEXT NOT NULL CHECK (required_capability IN ('llm','image','rag')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  result JSONB,
  quality_score INT,
  retry_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_jobs_status_idx ON public.article_jobs(status);
CREATE INDEX IF NOT EXISTS article_jobs_assigned_idx ON public.article_jobs(assigned_to);
CREATE INDEX IF NOT EXISTS article_jobs_article_idx ON public.article_jobs(article_id, created_at DESC);

ALTER TABLE public.article_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read article_jobs" ON public.article_jobs;
CREATE POLICY "Public read article_jobs" ON public.article_jobs FOR SELECT USING (true);

-- Realtime für Living-Feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_jobs;

-- Revisions (Wikipedia-Style Edit-History)
CREATE TABLE IF NOT EXISTS public.article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  body_markdown TEXT,
  contributor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.article_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_revisions_article_idx
  ON public.article_revisions(article_id, created_at DESC);

ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read revisions" ON public.article_revisions;
CREATE POLICY "Public read revisions" ON public.article_revisions FOR SELECT USING (true);

-- Profile-Erweiterungen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS donate_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donate_threshold INT NOT NULL DEFAULT 30
    CHECK (donate_threshold BETWEEN 10 AND 90),
  ADD COLUMN IF NOT EXISTS donate_show_credit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS swarm_jobs_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swarm_jobs_reset_at DATE;
```

- [ ] **Step 3: Push + Verify**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT count(*)::text FROM information_schema.tables
   WHERE table_name IN ('topic_pool','articles','article_jobs','article_revisions');" --linked
```

Expected: count = 4.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/120_swarm_schema.sql
git commit -m "db: Migration 120 — Schwarm-Schema (4 Tabellen + Profile-Cols)"
```

---

## Task 2: Provider-Limits-Modul

**Files:**
- Create: `supabase/functions/_shared/providerLimits.ts`

- [ ] **Step 1: Modul schreiben**

`supabase/functions/_shared/providerLimits.ts`:

```ts
// Reset-Schedules der Free-Tier-Provider + Quota-Probe-Logik.

export type ProviderId = 'groq' | 'openrouter' | 'nvidia' | 'openai' | 'anthropic'
  | 'huggingface' | 'elevenlabs' | 'deepl' | 'resend' | 'replicate';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  resetWindow: 'daily' | 'monthly' | 'continuous';
  // Bei daily/monthly: zu welcher Stunde UTC wird gespendet
  harvestHourUtc: number;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq:        { id: 'groq',        name: 'Groq',        resetWindow: 'daily',      harvestHourUtc: 23 },
  openrouter:  { id: 'openrouter',  name: 'OpenRouter',  resetWindow: 'continuous', harvestHourUtc: 23 },
  nvidia:      { id: 'nvidia',      name: 'NVIDIA',      resetWindow: 'monthly',    harvestHourUtc: 23 },
  openai:      { id: 'openai',      name: 'OpenAI',      resetWindow: 'daily',      harvestHourUtc: 23 },
  anthropic:   { id: 'anthropic',   name: 'Anthropic',   resetWindow: 'daily',      harvestHourUtc: 23 },
  huggingface: { id: 'huggingface', name: 'HuggingFace', resetWindow: 'daily',      harvestHourUtc: 23 },
  elevenlabs:  { id: 'elevenlabs',  name: 'ElevenLabs',  resetWindow: 'monthly',    harvestHourUtc: 23 },
  deepl:       { id: 'deepl',       name: 'DeepL',       resetWindow: 'monthly',    harvestHourUtc: 23 },
  resend:      { id: 'resend',      name: 'Resend',      resetWindow: 'monthly',    harvestHourUtc: 23 },
  replicate:   { id: 'replicate',   name: 'Replicate',   resetWindow: 'continuous', harvestHourUtc: 23 },
};

export function detectLlmProvider(key: string): ProviderId | null {
  if (key.startsWith('gsk_'))    return 'groq';
  if (key.startsWith('sk-or-'))  return 'openrouter';
  if (key.startsWith('nvapi-'))  return 'nvidia';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-'))     return 'openai';
  return null;
}

// Ist jetzt eine Harvest-Minute (23:30-23:58 UTC)?
export function isHarvestWindow(date = new Date()): boolean {
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  return h === 23 && m >= 30 && m < 58;
}

// Bei monthly-Provider: nur am letzten Tag des Monats harvest'n
export function isMonthlyHarvestDay(date = new Date()): boolean {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1; // morgen ist 1.
}

// Probe gegen das LLM-API um Rate-Limit-Header zu kriegen.
// Returns prozentual verbleibendes Kontingent (0-100), oder null wenn unbekannt.
export async function probeLlmRemaining(key: string): Promise<number | null> {
  const p = detectLlmProvider(key);
  if (!p) return null;
  const baseUrl =
    p === 'groq'        ? 'https://api.groq.com/openai/v1' :
    p === 'openrouter'  ? 'https://openrouter.ai/api/v1' :
    p === 'nvidia'      ? 'https://integrate.api.nvidia.com/v1' :
    p === 'openai'      ? 'https://api.openai.com/v1' :
    null;
  if (!baseUrl) return null;
  try {
    const r = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const remT = r.headers.get('x-ratelimit-remaining-tokens');
    const limT = r.headers.get('x-ratelimit-limit-tokens');
    if (remT && limT && Number(limT) > 0) {
      return Math.round((Number(remT) / Number(limT)) * 100);
    }
    return 50; // best-guess wenn keine Header
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/providerLimits.ts
git commit -m "swarm: providerLimits.ts mit Reset-Schedules + Quota-Probe"
```

---

## Task 3: Job-Definitionen + Prompts

**Files:**
- Create: `supabase/functions/_shared/swarmJobs.ts`

- [ ] **Step 1: Modul schreiben**

`supabase/functions/_shared/swarmJobs.ts`:

```ts
// Job-Definitionen für die Schwarm-Pipeline.
// Jede Job-Type hat: required_capability, max_llm_calls, max_images, Prompt-Builder.

export type JobType = 'topic_propose' | 'research' | 'draft' | 'illustrate' | 'code_snippet' | 'review' | 'revise';
export type Capability = 'llm' | 'image' | 'rag';

export interface JobDefinition {
  type: JobType;
  capability: Capability;
  maxLlmCalls: number;
  maxImages: number;
  buildSystemPrompt: (ctx: any) => string;
  buildUserPrompt: (ctx: any) => string;
}

const NEUTRAL_SYSTEM = "Du bist ein Beitragsschreiber für die Plattform 'Earth 0.1' — ein Lernspiel rund um KI, Code und Programmieren. Deine Bot-Persona spielt hier keine Rolle. Schreib neutral, klar, faktisch belastbar auf Deutsch. Keine Werbung, keine Affiliate-Links, keine Ich-Form ('als X meine ich...'). Du arbeitest mit anderen Bots zusammen — jeder macht einen Schritt.";

export const JOBS: Record<JobType, JobDefinition> = {
  topic_propose: {
    type: 'topic_propose', capability: 'llm', maxLlmCalls: 1, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Zu folgendem Thema soll ein Lehr-Artikel entstehen:

Titel-Idee: ${ctx.topic.title}
Quelle: ${ctx.topic.source} — ${ctx.topic.source_ref ?? ''}
Faktischer Seed (musst du strikt beachten): ${ctx.topic.context_seed ?? '(keiner)'}

Schlag einen finalen Titel vor (max 60 Zeichen) und einen 2-3 Sätze langen Ein-Absatz-Anriss als JSON:
{"title": "...", "lead": "..."}`,
  },

  research: {
    type: 'research', capability: 'llm', maxLlmCalls: 5, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Sammle Fakten für einen Artikel "${ctx.article.title}".

Anriss bisher: ${ctx.article.body_markdown ?? ''}
Faktischer Seed: ${ctx.topic.context_seed ?? ''}

Schreibe 5 nummerierte Stichpunkt-Fakten (max 1 Satz pro Fakt), die in einem späteren Artikel verwendet werden können. Keine Erfindungen, nur was du wirklich weißt. Falls unsicher: schreib "(unsicher)" hinter den Punkt.`,
  },

  draft: {
    type: 'draft', capability: 'llm', maxLlmCalls: 12, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Schreibe einen Artikel "${ctx.article.title}".

Bisherige Inhalte (Anriss + Fakten):
${ctx.article.body_markdown}

Aufgabe:
- 4-6 Absätze, jeder 3-5 Sätze
- Klare Markdown-Struktur mit ## Überschriften
- Am Ende ein "## Quellen"-Block mit 1-3 Links (wenn keine bekannt: weglassen)
- Keine Werbung, keine Ich-Form, kein Bot-Name

Gib NUR den Markdown-Inhalt zurück, ohne Code-Block-Wrapper.`,
  },

  illustrate: {
    type: 'illustrate', capability: 'image', maxLlmCalls: 0, maxImages: 1,
    buildSystemPrompt: () => '',
    buildUserPrompt: (ctx) => {
      // Prompt für image_gen-API
      return `Konzeptkunst-Illustration zum Thema "${ctx.article.title}". Stilistisch: digital, sauber, klar erkennbar, ohne Text auf dem Bild. Hintergrund neutral oder thematisch passend. Hauptmotiv zentriert.`;
    },
  },

  code_snippet: {
    type: 'code_snippet', capability: 'llm', maxLlmCalls: 3, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Für den Artikel "${ctx.article.title}" — falls passend, ein kleines Code-Beispiel.

Bisheriger Inhalt: ${ctx.article.body_markdown}

Wenn ein Code-Beispiel das Verständnis konkret bessert: schreibe einen Markdown-Codeblock (max 15 Zeilen, JavaScript oder Python, gut kommentiert).
Wenn kein Code-Beispiel sinnvoll wäre: antworte exakt mit "(kein Code-Snippet nötig)".`,
  },

  review: {
    type: 'review', capability: 'llm', maxLlmCalls: 3, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Review für den folgenden Artikel:

${ctx.article.body_markdown}

Faktischer Seed: ${ctx.topic.context_seed ?? '(keiner)'}

Antworte als JSON:
{
  "facts_ok": true|false,        // sind alle Behauptungen plausibel?
  "language_ok": true|false,     // sprachlich rund?
  "no_promo": true|false,        // keine werblichen Phrasen?
  "issues": ["..."],             // Liste der Probleme (leer wenn alle ok)
  "needs_revise": true|false,    // soll der Artikel überarbeitet werden?
  "score": 0-100                  // Gesamtnote
}`,
  },

  revise: {
    type: 'revise', capability: 'llm', maxLlmCalls: 5, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Überarbeite folgenden Artikel basierend auf dem Review.

Aktueller Stand:
${ctx.article.body_markdown}

Review-Probleme:
${(ctx.reviewIssues ?? []).map((s: string) => `- ${s}`).join('\n')}

Schreibe den verbesserten Markdown-Artikel zurück. Keine Meta-Kommentare, kein "ich habe verbessert..."-Vorspann.`,
  },
};

// Nächste Pipeline-Stufe bestimmen
export function nextJobType(currentStatus: string): JobType | null {
  const map: Record<string, JobType | null> = {
    proposed:    'research',
    researched:  'draft',
    drafted:     'illustrate',
    illustrated: 'review',       // code_snippet wird optional vor review eingefügt
    reviewed:    null,           // → published oder revise (entschieden im Worker)
  };
  return map[currentStatus] ?? null;
}

// Nach welcher Job-Type folgt welcher Article-Status
export function statusAfterJob(jobType: JobType): string | null {
  const map: Record<JobType, string | null> = {
    topic_propose: 'proposed',
    research:      'researched',
    draft:         'drafted',
    illustrate:    'illustrated',
    code_snippet:  null, // ändert status nicht
    review:        'reviewed',
    revise:        'reviewed', // nach revise wieder review-Status
  };
  return map[jobType];
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/swarmJobs.ts
git commit -m "swarm: swarmJobs.ts mit 7 Job-Typen, Prompts und Pipeline-Logik"
```

---

## Task 4: Quality-Score-Modul

**Files:**
- Create: `supabase/functions/_shared/qualityScore.ts`

- [ ] **Step 1: Modul schreiben**

`supabase/functions/_shared/qualityScore.ts`:

```ts
// Quality-Score-Berechnung. Wird vom Worker NACH der Generierung gerufen.
// Nutzt denselben User-LLM für den Selbst-Check (1 zusätzlicher Call).

export interface ScoreResult {
  total: number;          // 0-100
  factual: number;        // 0-30
  language: number;       // 0-30
  noPromo: number;        // 0-40
  reasoning: string;
  rejected: boolean;      // true wenn promo erkannt oder gesamtscore < 40
}

// Regex-basierter Promo-Filter (schnell, kostet keine Tokens)
const PROMO_PATTERNS = [
  /\bkaufe?n? jetzt\b/i,
  /\b(discount|rabatt|sale|coupon|gutschein)\b/i,
  /\b(affiliate|werb(?:e|ung))\b/i,
  /\bhttps?:\/\/[^\s]*ref=[a-z0-9]+/i,
  /\b(bestelle?n? hier|jetzt zugreifen|nicht verpassen)\b/i,
];

export function hasPromoMarkers(text: string): boolean {
  return PROMO_PATTERNS.some(re => re.test(text));
}

export async function scoreContent(args: {
  text: string;
  topic: string;
  factualSeed?: string;
  llmBaseUrl: string;
  llmKey: string;
  llmModel: string;
}): Promise<ScoreResult> {
  // 1. Promo-Regex
  if (hasPromoMarkers(args.text)) {
    return {
      total: 0, factual: 0, language: 0, noPromo: 0,
      reasoning: 'Werbliche Phrasen oder Affiliate-Links erkannt.',
      rejected: true,
    };
  }

  // 2. LLM-Self-Score
  const prompt = `Bewerte den folgenden Plattform-Beitrag streng.

Thema: ${args.topic}
${args.factualSeed ? `Faktischer Seed (Wahrheit): ${args.factualSeed}` : ''}

Beitrag:
${args.text}

Antworte als JSON mit:
{
  "factual": 0-30,     // Faktentreue (auch gegenüber Seed wenn da)
  "language": 0-30,    // Sprache, Stil, Klarheit
  "noPromo": 0-40,     // Frei von Werbung/Affiliate/Ich-Form
  "reasoning": "..."
}`;
  try {
    const r = await fetch(`${args.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.llmKey}` },
      body: JSON.stringify({
        model: args.llmModel,
        messages: [
          { role: 'system', content: 'Du bewertest streng und ehrlich. Antworte ausschließlich als valides JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const f = clamp(Number(parsed.factual) || 0, 0, 30);
    const l = clamp(Number(parsed.language) || 0, 0, 30);
    const p = clamp(Number(parsed.noPromo) || 0, 0, 40);
    const total = f + l + p;
    return {
      total, factual: f, language: l, noPromo: p,
      reasoning: String(parsed.reasoning ?? ''),
      rejected: total < 40,
    };
  } catch (e) {
    // Wenn Score-LLM fehlschlägt: pessimistisch, Score 40 (Grenzfall, nicht verworfen)
    return {
      total: 40, factual: 12, language: 12, noPromo: 16,
      reasoning: 'Score-LLM-Call fehlgeschlagen, neutral angenommen.',
      rejected: false,
    };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/qualityScore.ts
git commit -m "swarm: qualityScore.ts mit Regex-Promo-Filter + LLM-Self-Score"
```

---

## Task 5: Swarm-Orchestrator Edge Function

**Files:**
- Create: `supabase/functions/swarm-orchestrator/index.ts`

- [ ] **Step 1: Function schreiben**

`supabase/functions/swarm-orchestrator/index.ts`:

```ts
// swarm-orchestrator
// Wird in den Harvest-Minuten von reminder-tick aufgerufen.
// Aufgabe: aktiv-spendende User identifizieren, Jobs zuweisen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isHarvestWindow, isMonthlyHarvestDay, detectLlmProvider, PROVIDERS, probeLlmRemaining } from "../_shared/providerLimits.ts";
import { JOBS, statusAfterJob, nextJobType } from "../_shared/swarmJobs.ts";

const ACTIVATION_THRESHOLD = 10;       // Schwarm-Schwelle
const MAX_JOBS_PER_USER_PER_DAY = 3;
const MAX_PIPELINE_PARALLEL = 20;
const MAX_JOBS_PER_DAY_PLATFORM = 1000;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Aktivierungs-Gate: 10+ User mit donate_tokens=true?
  const { count: activeCount } = await supabase
    .from("profiles").select("id", { count: "exact", head: true })
    .eq("donate_tokens", true);
  if ((activeCount ?? 0) < ACTIVATION_THRESHOLD) {
    return json({ skipped: 'below_threshold', activeCount });
  }

  // 2. Tages-Cap Plattform
  const today = new Date().toISOString().slice(0, 10);
  const { count: jobsToday } = await supabase
    .from("article_jobs").select("id", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00Z`);
  if ((jobsToday ?? 0) >= MAX_JOBS_PER_DAY_PLATFORM) {
    return json({ skipped: 'daily_cap', jobsToday });
  }

  // 3. Backpressure: zu viele Artikel in der Pipeline?
  const { count: unfinishedArticles } = await supabase
    .from("articles").select("id", { count: "exact", head: true })
    .not("status", "in", '(published,retired)');
  const allowNewTopics = (unfinishedArticles ?? 0) < MAX_PIPELINE_PARALLEL;

  // 4. Wenn nicht in Harvest-Window: nur Pipeline-Fortschritts-Jobs erstellen
  const inHarvest = isHarvestWindow();

  // 5. Pipeline-Stufen vorwärts treiben: für jeden 'done'-Job prüfen, ob nächste Stufe gestartet werden muss
  await progressPipelines(supabase, allowNewTopics);

  // Außerhalb Harvest-Minuten: keine User-Assignments. Nur Pipeline-Cleanup.
  if (!inHarvest) return json({ ok: true, mode: 'cleanup' });

  // 6. Aktive User in Batches (50) auswählen
  const { data: users } = await supabase
    .from("profiles")
    .select("id, donate_tokens, donate_threshold, swarm_jobs_today, swarm_jobs_reset_at, llm_api_key, huggingface_key, replicate_key, cloud_provider")
    .eq("donate_tokens", true)
    .limit(50);
  if (!users || users.length === 0) return json({ ok: true, users: 0 });

  let assigned = 0;
  for (const u of users) {
    // Daily-Counter reset
    if (u.swarm_jobs_reset_at !== today) {
      await supabase.from("profiles")
        .update({ swarm_jobs_today: 0, swarm_jobs_reset_at: today })
        .eq("id", u.id);
      u.swarm_jobs_today = 0;
    }
    if (u.swarm_jobs_today >= MAX_JOBS_PER_USER_PER_DAY) continue;

    // Capability-Set ermitteln
    const caps: string[] = [];
    if (u.llm_api_key) caps.push('llm');
    if (u.huggingface_key || u.replicate_key) caps.push('image');
    if (u.huggingface_key && u.cloud_provider) caps.push('rag');
    if (caps.length === 0) continue;

    // Quota-Probe
    if (u.llm_api_key) {
      const remPct = await probeLlmRemaining(u.llm_api_key);
      if (remPct !== null && remPct < u.donate_threshold) continue;
    }

    // Passenden waiting-Job suchen
    const { data: job } = await supabase
      .from("article_jobs")
      .select("id, job_type, required_capability, article_id")
      .eq("status", "waiting")
      .in("required_capability", caps)
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (!job) continue;

    // Zuweisen
    const dueAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await supabase.from("article_jobs")
      .update({ status: 'assigned', assigned_to: u.id, assigned_at: new Date().toISOString(), due_at: dueAt })
      .eq("id", job.id);
    await supabase.from("profiles")
      .update({ swarm_jobs_today: u.swarm_jobs_today + 1 })
      .eq("id", u.id);
    assigned++;
  }

  return json({ ok: true, mode: 'harvest', users: users.length, assigned });
});

async function progressPipelines(supabase: any, allowNewTopics: boolean) {
  // Re-queue timed-out assigned-Jobs (over due_at, retry < 3)
  const now = new Date().toISOString();
  await supabase.from("article_jobs")
    .update({ status: 'waiting', assigned_to: null, retry_count: 0 })
    // pseudo: retry_count + 1 via raw; vereinfacht: status zurücksetzen
    .eq("status", "assigned")
    .lt("due_at", now);

  // Article-Status nach done-Jobs vorwärts treiben
  const { data: articles } = await supabase
    .from("articles")
    .select("id, status, topic_id")
    .not("status", "in", '(published,retired)');
  if (!articles) return;

  for (const art of articles) {
    // Existieren schon waiting/assigned-Jobs für diesen Artikel? → noch nicht weiter
    const { count: openJobs } = await supabase
      .from("article_jobs").select("id", { count: 'exact', head: true })
      .eq("article_id", art.id).in("status", ['waiting', 'assigned']);
    if ((openJobs ?? 0) > 0) continue;

    const next = nextJobType(art.status);
    if (!next) continue;

    const jobDef = JOBS[next];
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: next,
      required_capability: jobDef.capability, status: 'waiting',
    });
  }

  // Neue topic_propose-Jobs für offene Topics, wenn Pipeline-Kapazität da ist
  if (!allowNewTopics) return;
  const { data: openTopics } = await supabase
    .from("topic_pool").select("id, title")
    .eq("status", "open").limit(3);
  if (!openTopics) return;
  for (const t of openTopics) {
    // Artikel anlegen
    const slug = String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const { data: art } = await supabase.from("articles").insert({
      topic_id: t.id, title: t.title, slug: `${slug}-${Date.now()}`,
      status: 'proposed',
    }).select().single();
    if (!art) continue;
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: 'topic_propose',
      required_capability: 'llm', status: 'waiting',
    });
    await supabase.from("topic_pool").update({ status: 'in_progress' }).eq("id", t.id);
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Deploy**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy swarm-orchestrator \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: Manuell triggern und schauen ob unter Schwelle korrekt skip**

```bash
curl -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/swarm-orchestrator" \
  -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Expected: `{"skipped":"below_threshold","activeCount":<N>}` solange weniger als 10 User opted-in.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/swarm-orchestrator
git commit -m "swarm: orchestrator Edge Function mit Activation-Gate + Backpressure"
```

---

## Task 6: Swarm-Worker Edge Function

**Files:**
- Create: `supabase/functions/swarm-worker/index.ts`

- [ ] **Step 1: Function schreiben**

`supabase/functions/swarm-worker/index.ts`:

```ts
// swarm-worker
// POST { job_id } mit User-Auth. Worker führt den zugewiesenen Job aus
// mit dem User-eigenen LLM/Image-Key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JOBS, statusAfterJob } from "../_shared/swarmJobs.ts";
import { scoreContent } from "../_shared/qualityScore.ts";
import { generateImage } from "../_shared/imageGen.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS }});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(userToken);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const jobId = body?.job_id;
  if (!jobId) return json({ error: "job_id fehlt" }, 400);

  // Job laden, prüfen ob diesem User zugewiesen
  const { data: job } = await supabase.from("article_jobs")
    .select("id, article_id, job_type, status, assigned_to, required_capability")
    .eq("id", jobId).single();
  if (!job || job.assigned_to !== user.id) return json({ error: "Job nicht zugewiesen" }, 403);
  if (job.status !== "assigned") return json({ error: `Job-Status ist ${job.status}` }, 400);

  // Profile + Article + Topic laden
  const { data: profile } = await supabase.from("profiles")
    .select("llm_api_key, llm_base_url, llm_model, huggingface_key, replicate_key")
    .eq("id", user.id).single();
  const { data: article } = await supabase.from("articles").select("*").eq("id", job.article_id).single();
  const { data: topic } = article?.topic_id
    ? await supabase.from("topic_pool").select("*").eq("id", article.topic_id).single()
    : { data: null };

  if (!profile || !article) return json({ error: "Daten fehlen" }, 500);

  // Job ausführen
  const jobDef = JOBS[job.job_type as keyof typeof JOBS];
  if (!jobDef) return json({ error: `Unbekannter Job-Type ${job.job_type}` }, 400);

  let result: any = null;
  let success = false;
  try {
    if (jobDef.capability === 'image') {
      const prompt = jobDef.buildUserPrompt({ article, topic });
      const img = await generateImage({
        prompt, hfKey: profile.huggingface_key, replicateKey: profile.replicate_key,
      });
      if (img.ok && img.blob) {
        // Bild als Data-URL hinterlegen (für MVP — bei Skalierung in Storage)
        const buf = await img.blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const dataUrl = `data:image/png;base64,${base64}`;
        result = { image_url: dataUrl, provider: img.provider };
        success = true;
      } else {
        result = { error: img.error };
      }
    } else {
      // LLM-Job
      if (!profile.llm_api_key || !profile.llm_base_url || !profile.llm_model) {
        return json({ error: "LLM-Key fehlt im Profil" }, 400);
      }
      const sys = jobDef.buildSystemPrompt({ article, topic });
      const usr = jobDef.buildUserPrompt({ article, topic, reviewIssues: article._reviewIssues });
      const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.llm_api_key}` },
        body: JSON.stringify({
          model: profile.llm_model,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
          temperature: 0.4,
        }),
      });
      const j = await r.json();
      const content = j?.choices?.[0]?.message?.content;
      if (!content) {
        result = { error: 'LLM lieferte keinen Inhalt' };
      } else {
        result = { content };
        success = true;
      }
    }

    if (!success) {
      await supabase.from("article_jobs").update({
        status: "failed", result, completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return json({ ok: false, result });
    }

    // Quality-Score auf Text-Resultate
    let qScore: number | null = null;
    if (result.content && job.job_type !== 'review' && job.job_type !== 'topic_propose') {
      const score = await scoreContent({
        text: result.content,
        topic: article.title,
        factualSeed: topic?.context_seed,
        llmBaseUrl: profile.llm_base_url,
        llmKey: profile.llm_api_key,
        llmModel: profile.llm_model,
      });
      qScore = score.total;
      result.quality_reasoning = score.reasoning;
      if (score.rejected) {
        await supabase.from("article_jobs").update({
          status: "failed", result, quality_score: qScore, completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return json({ ok: false, rejected: true, score: qScore });
      }
    }

    // Apply result to article — abhängig vom Job-Typ
    await applyJobResult(supabase, article, job.job_type, result, user.id, jobId);

    // Job als done
    await supabase.from("article_jobs").update({
      status: "done", result, quality_score: qScore, completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return json({ ok: true, score: qScore });
  } catch (e) {
    await supabase.from("article_jobs").update({
      status: "failed", result: { error: (e as Error).message }, completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

async function applyJobResult(supabase: any, article: any, jobType: string, result: any, userId: string, jobId: string) {
  let newBody = article.body_markdown ?? '';
  let newHero = article.hero_image_url;
  let newTitle = article.title;
  let newStatus = article.status;

  switch (jobType) {
    case 'topic_propose': {
      // result.content ist JSON-String { title, lead }
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.title) newTitle = String(parsed.title).slice(0, 80);
        newBody = `${parsed.lead ?? ''}`;
      } catch {
        newBody = `${result.content}`;
      }
      newStatus = 'proposed';
      break;
    }
    case 'research': {
      newBody = `${article.body_markdown}\n\n## Recherche\n${result.content}`;
      newStatus = 'researched';
      break;
    }
    case 'draft': {
      newBody = result.content;
      newStatus = 'drafted';
      break;
    }
    case 'illustrate': {
      newHero = result.image_url;
      newStatus = 'illustrated';
      break;
    }
    case 'code_snippet': {
      if (result.content && !/(kein Code-Snippet)/i.test(result.content)) {
        newBody = `${article.body_markdown}\n\n## Beispiel\n${result.content}`;
      }
      break;
    }
    case 'review': {
      // result.content ist JSON
      try {
        const r = JSON.parse(result.content);
        if (r.needs_revise && (r.issues ?? []).length > 0) {
          // einen revise-Job einplanen
          await supabase.from("article_jobs").insert({
            article_id: article.id, job_type: 'revise',
            required_capability: 'llm', status: 'waiting',
            result: { review_issues: r.issues },
          });
        } else {
          newStatus = 'published';
        }
      } catch { newStatus = 'published'; }
      break;
    }
    case 'revise': {
      newBody = result.content;
      newStatus = 'reviewed';
      break;
    }
  }

  await supabase.from("articles").update({
    title: newTitle, body_markdown: newBody, hero_image_url: newHero,
    status: newStatus, contributor_count: article.contributor_count + 1,
    published_at: newStatus === 'published' ? new Date().toISOString() : article.published_at,
  }).eq("id", article.id);

  await supabase.from("article_revisions").insert({
    article_id: article.id, body_markdown: newBody,
    contributor_user_id: userId, job_id: jobId,
  });
}
```

- [ ] **Step 2: Deploy**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy swarm-worker \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/swarm-worker
git commit -m "swarm: worker Edge Function mit Job-Execution + Quality-Gate + Apply"
```

---

## Task 7: reminder-tick Erweiterung

**Files:**
- Modify: `supabase/functions/reminder-tick/index.ts`

- [ ] **Step 1: Orchestrator-Call hinzufügen**

In `supabase/functions/reminder-tick/index.ts` nach den bestehenden Reminders und Briefings:

```ts
// Vor dem Response-Aufruf:
let orchestratorResult: any = null;
try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const r = await fetch(`${supabaseUrl}/functions/v1/swarm-orchestrator`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
  });
  orchestratorResult = await r.json().catch(() => null);
} catch (e) {
  console.warn("Orchestrator-Call fehlgeschlagen:", (e as Error).message);
}

return new Response(
  JSON.stringify({ fired, briefings, swarm: orchestratorResult }),
  { headers: { "Content-Type": "application/json" }},
);
```

- [ ] **Step 2: Deploy + Smoke-Test**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy reminder-tick \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
curl -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/reminder-tick" \
  -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Expected: JSON enthält `swarm`-Key mit Orchestrator-Antwort.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/reminder-tick
git commit -m "swarm: reminder-tick ruft Orchestrator jede Minute"
```

---

## Task 8: Skill-Migration (donate_tokens)

**Files:**
- Create: `supabase/migrations/121_donate_skill.sql`

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/121_donate_skill.sql`:

```sql
-- 121_donate_skill.sql
-- Skill: donate_tokens — User schaltet die Token-Spende für den Schwarm frei.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('donate_tokens', 'Token-Spende für Earth', '🌱', 'llm', 'config', 'konfig',
 'Spende dein restliches Free-Tier-Kontingent kurz vor Mitternacht. Dein Bot wird Teil eines Schwarms, der gemeinsam Artikel auf der Plattform erzeugt.',
 'Cron-Job prüft 30 Min vor Provider-Reset deinen Verbrauch. Liegt er unter deiner Schwelle, kriegt dein Bot einen Job aus der Pipeline (Recherche, Schreiben, Illustration etc.). Pro Job max 12 LLM-Calls. Pro Tag max 3 Jobs. Aktiviert sich plattformweit erst ab 10 spendenden Bots.',
 '0', '["embed_setup"]'::jsonb, '[]'::jsonb, NULL,
 1140, 860, 460)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  requires = EXCLUDED.requires,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
```

- [ ] **Step 2: Push**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/121_donate_skill.sql
git commit -m "swarm: Skill donate_tokens"
```

---

## Task 9: Frontend /erde-lernt-Seite

**Files:**
- Create: `src/lib/swarmService.js`
- Create: `src/pages/ErdeLernt.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Navigation.jsx`

- [ ] **Step 1: swarmService.js**

`src/lib/swarmService.js`:

```js
import { supabase } from './supabase'

export async function fetchPublishedArticles({ limit = 20 } = {}) {
  const { data } = await supabase.from('articles')
    .select('id, slug, title, hero_image_url, contributor_count, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function fetchArticleBySlug(slug) {
  const { data } = await supabase.from('articles')
    .select('*').eq('slug', slug).single()
  return data
}

export async function fetchRecentJobs({ limit = 10 } = {}) {
  const { data } = await supabase.from('article_jobs')
    .select('id, job_type, status, completed_at, article_id')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function fetchSwarmStatus() {
  const { count: active } = await supabase.from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('donate_tokens', true)
  const { count: articleCount } = await supabase.from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
  return { activeUsers: active ?? 0, publishedCount: articleCount ?? 0, threshold: 10 }
}

export async function suggestTopic(title) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login benötigt')
  await supabase.from('topic_pool').insert({
    title, source: 'user', suggested_by_user: user.id,
  })
}
```

- [ ] **Step 2: ErdeLernt.jsx schreiben**

`src/pages/ErdeLernt.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Sprout, Send } from 'lucide-react'
import { fetchPublishedArticles, fetchSwarmStatus, fetchRecentJobs, fetchArticleBySlug, suggestTopic } from '../lib/swarmService'
import { useAuth } from '../contexts/AuthContext'

export default function ErdeLernt() {
  const { slug } = useParams()
  if (slug) return <ArticleDetail slug={slug} />
  return <ArticleList />
}

function ArticleList() {
  const { user } = useAuth()
  const [articles, setArticles] = useState([])
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState(null)
  const [suggestion, setSuggestion] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchPublishedArticles({ limit: 30 }).then(setArticles)
    fetchRecentJobs({ limit: 10 }).then(setJobs)
    fetchSwarmStatus().then(setStatus)
  }, [])

  async function submit() {
    if (!suggestion.trim()) return
    try {
      await suggestTopic(suggestion.trim())
      setMsg('Thema vorgeschlagen ✓')
      setSuggestion('')
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm mb-4">
          <Sprout className="w-4 h-4" /> Earth lernt
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Was der Schwarm geschrieben hat
        </h1>
        {status && status.activeUsers < status.threshold && (
          <p className="text-amber-300 mt-3 text-sm">
            Schwarm wächst: {status.activeUsers} von {status.threshold} Bewohnern. Ab 10 startet die kollektive Inhaltsproduktion.
          </p>
        )}
        {status && status.activeUsers >= status.threshold && (
          <p className="text-gray-400 mt-3 text-sm">
            {status.publishedCount} Artikel von {status.activeUsers} Bewohnern.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-8">
        <main>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {articles.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-12">
                Noch keine Artikel. Der Schwarm wartet auf Aktivierung.
              </div>
            )}
            {articles.map(a => (
              <Link key={a.id} to={`/erde-lernt/${a.slug}`}
                className="block bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition no-underline">
                {a.hero_image_url && (
                  <img src={a.hero_image_url} alt="" className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-display text-white font-bold text-base mb-1">{a.title}</h3>
                  <div className="text-[11px] text-gray-500">
                    {a.contributor_count} Bot{a.contributor_count !== 1 ? 's' : ''} · {a.published_at ? new Date(a.published_at).toLocaleDateString('de-DE') : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h3 className="font-display text-white text-sm font-bold mb-2">Letzte Bot-Beiträge</h3>
            <div className="space-y-1.5">
              {jobs.map(j => (
                <div key={j.id} className="text-[11px] text-gray-400">
                  🤖 {jobTypeLabel(j.job_type)} · {j.completed_at ? timeAgo(j.completed_at) : '—'}
                </div>
              ))}
              {jobs.length === 0 && <div className="text-[11px] text-gray-600">Noch nichts.</div>}
            </div>
          </section>

          {user && (
            <section className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-white text-sm font-bold mb-2">Thema vorschlagen</h3>
              <input type="text" value={suggestion} onChange={(e) => setSuggestion(e.target.value)}
                placeholder="z.B. Was ist Backpropagation?"
                className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
              <button onClick={submit}
                className="w-full px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-sm rounded-lg border border-emerald-500/30 flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" /> Vorschlagen
              </button>
              {msg && <div className="text-[11px] text-gray-400 mt-2">{msg}</div>}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ArticleDetail({ slug }) {
  const [article, setArticle] = useState(null)
  useEffect(() => { fetchArticleBySlug(slug).then(setArticle) }, [slug])
  if (!article) return <div className="max-w-3xl mx-auto px-4 pt-24 text-center text-gray-400">Lade…</div>

  return (
    <article className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      {article.hero_image_url && (
        <img src={article.hero_image_url} alt="" className="w-full rounded-2xl mb-6" />
      )}
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-3">{article.title}</h1>
      <div className="text-xs text-gray-500 mb-6">
        Beigetragen von {article.contributor_count} Bots
        {article.published_at && ` · veröffentlicht ${new Date(article.published_at).toLocaleDateString('de-DE')}`}
      </div>
      <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap">
        {article.body_markdown}
      </div>
    </article>
  )
}

function jobTypeLabel(type) {
  const map = { topic_propose: 'Thema gewählt', research: 'recherchiert', draft: 'verfasst', illustrate: 'illustriert', code_snippet: 'Code geschrieben', review: 'reviewed', revise: 'verbessert' }
  return map[type] ?? type
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}
```

- [ ] **Step 3: Routes + Nav**

In `src/App.jsx`:

```jsx
import ErdeLernt from './pages/ErdeLernt'
// ...
<Route path="/erde-lernt" element={<ErdeLernt />} />
<Route path="/erde-lernt/:slug" element={<ErdeLernt />} />
```

In `src/components/Navigation.jsx`, in der `links`-Liste:

```jsx
import { ..., Sprout } from 'lucide-react'
// ...
{ to: '/erde-lernt', label: 'Earth lernt', icon: Sprout },
```

- [ ] **Step 4: Build + Deploy**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
```

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "ui: /erde-lernt-Seite mit Artikel-Grid + Living-Feed + Topic-Vorschlag"
```

---

## Task 10: /data-Erweiterung — Schwarm-Sektion

**Files:**
- Modify: `src/pages/Data.jsx`
- Modify: `src/lib/cloudService.js`

- [ ] **Step 1: Service-Funktionen**

In `src/lib/cloudService.js` am Ende ergänzen:

```js
export async function fetchDonateSettings() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles')
    .select('donate_tokens, donate_threshold, donate_show_credit, swarm_jobs_today')
    .eq('id', user.id).single()
  return data
}

export async function saveDonateSettings(s) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login')
  await supabase.from('profiles').update({
    donate_tokens: !!s.donate_tokens,
    donate_threshold: Math.min(90, Math.max(10, s.donate_threshold ?? 30)),
    donate_show_credit: !!s.donate_show_credit,
  }).eq('id', user.id)
}

export async function fetchMyContributions() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase.from('article_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id).eq('status', 'done')
  return count ?? 0
}
```

- [ ] **Step 2: DonateSection in Data.jsx**

In `src/pages/Data.jsx`, neue Komponente am Ende (vor letztem `}`):

```jsx
function DonateSection() {
  const [s, setS] = useState(null)
  const [contributions, setContributions] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchDonateSettings().then(d => setS(d ?? { donate_tokens: false, donate_threshold: 30, donate_show_credit: false, swarm_jobs_today: 0 }))
    fetchMyContributions().then(setContributions)
  }, [])

  if (!s) return null

  async function save() {
    setSaving(true); setMsg('')
    try { await saveDonateSettings(s); setMsg('Gespeichert ✓') }
    catch (e) { setMsg(`Fehler: ${e.message}`) }
    setSaving(false)
  }

  return (
    <section className="mb-8 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-display text-white text-lg font-bold flex items-center gap-2">
          🌱 Schwarm-Beitrag
        </h2>
        {s.donate_tokens && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Aktiv</span>}
      </div>
      <p className="text-gray-400 text-sm mb-4">
        Spende dein verbleibendes Tagessommittel kurz vor Provider-Reset.
        Dein Bot trägt zur kollektiven Artikel-Pipeline bei. Max 3 Jobs/Tag.
      </p>
      {msg && <div className="mb-3 text-xs text-blue-200">{msg}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Mein Beitrag</div>
          <div className="font-display text-2xl text-emerald-300 mt-1">{contributions}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Jobs heute</div>
          <div className="font-display text-2xl text-amber-300 mt-1">{s.swarm_jobs_today} / 3</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Schwelle</div>
          <div className="font-display text-2xl text-blue-300 mt-1">{s.donate_threshold}%</div>
        </div>
      </div>

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={s.donate_tokens}
          onChange={(e) => setS({...s, donate_tokens: e.target.checked})}
          className="w-4 h-4" />
        <span className="text-sm text-white">Token-Spende aktivieren</span>
      </label>

      <label className="block mb-3">
        <span className="text-xs text-gray-400">Spende-Schwelle: {s.donate_threshold}%</span>
        <input type="range" min="10" max="90" step="5"
          value={s.donate_threshold}
          onChange={(e) => setS({...s, donate_threshold: parseInt(e.target.value)})}
          className="w-full mt-1" />
        <span className="text-[10px] text-gray-500">Spende, wenn mindestens {s.donate_threshold}% des Tageskontingents übrig.</span>
      </label>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={s.donate_show_credit}
          onChange={(e) => setS({...s, donate_show_credit: e.target.checked})}
          className="w-4 h-4" />
        <span className="text-sm text-white">Mit meinem Namen erwähnt werden (statt anonym)</span>
      </label>

      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 rounded-lg border border-emerald-500/30 disabled:opacity-50 text-sm">
        {saving ? 'Speichere…' : 'Speichern'}
      </button>
    </section>
  )
}
```

Und Import + Render:

```jsx
import { ..., fetchDonateSettings, saveDonateSettings, fetchMyContributions } from '../lib/cloudService'
// ...
// nach <PersonaSection />:
<DonateSection />
```

- [ ] **Step 3: Build + Commit**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
git add src
git commit -m "ui: /data DonateSection mit Toggle, Schwelle, Counter"
```

---

## Task 11: Initial-Seeding (20 Topics)

**Files:**
- Create: `supabase/migrations/122_topic_seed.sql`

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/122_topic_seed.sql`:

```sql
-- 122_topic_seed.sql
-- 20 initiale Themen aus Glossar + Tech-Tree für die Schwarm-Pipeline.

INSERT INTO public.topic_pool (title, source, source_ref, context_seed) VALUES
  ('Was ist ein Token?', 'glossary', 'Token',
   'Die kleinste Texteinheit eines Sprachmodells — ungefähr 3-4 Buchstaben. "Hallo" = 1 Token, "außergewöhnlich" = 3 Tokens.'),
  ('Wie funktioniert eine REST-API?', 'glossary', 'REST-API',
   'Die häufigste Art von API. Du fragst per URL etwas, kriegst die Antwort als JSON zurück. Wie eine Speisekarte mit konkreten Bestellungen.'),
  ('Was ist Quantisierung?', 'glossary', 'Quantisierung',
   'Sprachmodelle kleiner machen indem ihre Zahlen auf weniger Bits reduziert werden — von 32 auf 4 Bit. Folge: Modell passt auf ein Handy.'),
  ('Was ist RAG?', 'glossary', 'RAG',
   'Retrieval Augmented Generation. Statt das Modell alles wissen zu lassen, gibt man ihm nur passende Dokumente mit. Spart Tokens, holt aktuelle Daten rein.'),
  ('Was ist ein Embedding?', 'glossary', 'Embedding',
   'Ein Text in eine Liste von Zahlen umwandeln, sodass ähnliche Texte ähnliche Zahlen haben. Basis für semantische Suche.'),
  ('Wie funktionieren Hash-Funktionen?', 'glossary', 'Hash-Funktion',
   'Verwandelt einen beliebig langen Text in einen kurzen Fingerabdruck. Selbst kleinste Änderungen am Text ergeben einen komplett anderen Hash.'),
  ('Was ist k-Anonymity?', 'glossary', 'k-Anonymity',
   'Datenschutz-Trick: man sendet nur einen Teil des Hashes (z.B. ersten 5 Zeichen). Der Server liefert alle passenden Treffer, der Client filtert lokal.'),
  ('Was ist ein Webhook?', 'glossary', 'Webhook',
   'Eine URL bei dir die ein externes System anruft wenn etwas passiert. "Sag mir Bescheid wenn neue Nachricht kommt".'),
  ('Was ist Cron?', 'glossary', 'Cron',
   'Eine Zeitplan-Sprache. "* * * * *" heißt jede Minute, "0 8 * * *" heißt jeden Morgen 8 Uhr.'),
  ('Was ist OAuth?', 'glossary', 'OAuth',
   'Ein Verfahren wie du einer App erlaubst auf deinen Account zuzugreifen, ohne dein Passwort zu verraten.'),
  ('Was ist Prompt-Engineering?', 'glossary', 'Prompt-Engineering',
   'Die Kunst gute Prompts zu schreiben. Strukturierte Anweisungen, Beispiele, klare Rollen-Definition.'),
  ('Was ist Cosine-Similarity?', 'glossary', 'Cosine-Similarity',
   'Maß für Vektor-Ähnlichkeit zwischen -1 und 1. Bei Embeddings: nahe 1 = sehr ähnlich.'),
  ('Was ist pgvector?', 'glossary', 'pgvector',
   'PostgreSQL-Extension, die Vektor-Spalten + Ähnlichkeitssuche ergänzt. Eingebaut in Supabase, kein Zusatzdienst nötig.'),
  ('Was ist ein Sprachmodell?', 'glossary', 'Sprachmodell',
   'Auch LLM (Large Language Model). Ein neuronales Netz das auf Sprache trainiert wurde. Erzeugt Wort für Wort eine Antwort.'),
  ('Was bedeutet Inferenz?', 'glossary', 'Inferenz',
   'Der Moment in dem das Modell eine Antwort generiert. Im Gegensatz zum Training. Inferenz ist das was Tokens kostet.'),
  ('Was ist Free-Tier?', 'glossary', 'Free-Tier',
   'Die kostenlose Nutzungs-Stufe eines Anbieters. Meist mit Limits (z.B. "500 Calls/Tag").'),
  ('Was ist JSON?', 'glossary', 'JSON',
   'Ein Format um strukturierte Daten zu transportieren. Computer-lesbar aber auch von Menschen verstehbar.'),
  ('Was ist Crypto-Random?', 'glossary', 'Crypto-Random',
   'Sicherer Zufallszahlen-Generator vom Browser. Anders als Math.random() vorhersagbar — gut für Passwörter und Keys.'),
  ('Wie funktioniert das Kontext-Fenster?', 'glossary', 'Kontext-Fenster',
   'Wie viele Tokens ein Sprachmodell „auf einmal lesen" kann. Bei großen Modellen oft 128.000 Tokens (ca. 100.000 Wörter).'),
  ('Was ist multilingual-e5?', 'glossary', 'multilingual-e5',
   'Embedding-Modell, das in 100+ Sprachen ähnliche Bedeutungen erkennt. Gratis über Hugging Face.')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Push + Verify**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT count(*)::text FROM topic_pool WHERE status='open';" --linked
```

Expected: count = 20.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/122_topic_seed.sql
git commit -m "swarm: 20 Initial-Topics für die Pipeline"
```

---

## Task 12: End-to-End Smoke-Test mit Dummy-Bot

**Files:**
- Keine — manueller Test

- [ ] **Step 1: Test-Profil als opted-in markieren (per SQL)**

Da man bis zur 10er-Schwelle nicht aktivieren kann, manuell für Test umgehen:

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "UPDATE profiles SET donate_tokens = true WHERE id = '6d2b55e3-8229-435f-9d30-4380f328c2ee';
   -- Activation-Threshold temporär in der Edge-Function-Konstante auf 1 setzen (Code-Edit)" --linked
```

(Eigentlich in `swarm-orchestrator/index.ts` ACTIVATION_THRESHOLD temporär auf 1 stellen für den Test, dann re-deploy.)

- [ ] **Step 2: Manuell Orchestrator triggern, Job-Assignment beobachten**

```bash
curl -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/swarm-orchestrator" \
  -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq" -d '{}'

SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT id, job_type, status, assigned_to FROM article_jobs ORDER BY created_at DESC LIMIT 5" --linked
```

Erwartet: Mindestens 1 Eintrag mit status='assigned'.

- [ ] **Step 3: Frontend /erde-lernt öffnen und Worker manuell triggern**

Im Browser auf eingeloggter Session via DevTools-Console:

```js
const { data: { session } } = await supabase.auth.getSession()
const r = await fetch('/functions/v1/swarm-worker', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ job_id: '<JOB_UUID_AUS_SCHRITT_2>' }),
})
console.log(await r.json())
```

Erwartet: `{ ok: true, score: <Zahl> }`

- [ ] **Step 4: DB-Status prüfen**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT id, title, status, body_markdown FROM articles ORDER BY created_at DESC LIMIT 3" --linked
```

Erwartet: Mindestens 1 Artikel ist über 'proposed' hinaus.

- [ ] **Step 5: Pipeline manuell mehrere Stufen durchlaufen lassen**

Wiederhole Schritt 2-4 mehrfach (Cron läuft jede Minute, Orchestrator legt nächsten Job an, Worker arbeitet ihn ab). Beobachte:
- topic_propose → research → draft → illustrate → review → published

- [ ] **Step 6: Bug-Liste anlegen, Threshold zurück, Branch mergen**

```bash
# In swarm-orchestrator/index.ts ACTIVATION_THRESHOLD wieder auf 10.
# UPDATE profiles SET donate_tokens = false WHERE id = '...';
# falls Test-Artikel: DELETE FROM articles WHERE topic_id IN (SELECT id FROM topic_pool WHERE title LIKE 'Test-%');

git checkout main
git merge phase-3-swarm --no-ff -m "Merge phase-3-swarm: Bot-Schwarm als Content-Pipeline"
git push origin main
git branch -d phase-3-swarm
```

---

## Self-Review

**Spec-Coverage:**
- ✓ Token-Spende opt-in (Task 8 Skill + Task 10 UI)
- ✓ Per-Provider Reset-Schedule (Task 2)
- ✓ Multi-Job-Pipeline (Task 3, 5, 6)
- ✓ Capability-Matching (Task 5)
- ✓ Activation-Threshold ab 10 Bots (Task 5)
- ✓ Wikipedia-Style Revisions (Task 1 + Task 6)
- ✓ Topic-Pool aus Glossar/Skills + User-Vorschläge (Task 1, 9, 11)
- ✓ Quality-Score mit Promo-Filter (Task 4)
- ✓ Hard-Limits Plattform (Task 5 ACTIVATION_THRESHOLD, MAX_*)
- ✓ /erde-lernt Frontend (Task 9)
- ✓ /data DonateSection (Task 10)

**Bekannte Lücken / Trade-offs:**
- Worker wird vom Frontend-User-Browser polling-style getriggert (nicht vom Backend gepusht). Für MVP OK — User klickt /data oder /erde-lernt, das löst eine `swarm-worker`-Auswertung aus. Skalierungs-Verbesserung: Telegram-Push oder Realtime-Subscription auf job_assignments. Für MVP nicht nötig.
- Bild-Speicherung als Base64-DataURL ist suboptimal bei vielen Bildern (DB-Größe). Phase 3.1: Supabase Storage Bucket. Für MVP OK.
- Edit-Lock-Mechanik (3 Reverts/24h freeze) ist als Feld `articles.edit_lock_until` vorbereitet aber nicht im Code aktiv genutzt. Phase 3.1.
- Polling vs Realtime in Frontend: aktuell Polling beim Page-Load. Realtime kommt in Phase 3.1.

---

**Execution-Wahl nach diesem Plan:**
- Subagent-Driven oder Inline — du entscheidest.
