# Phase 3 — Earth 0.1 wächst: Bot-Schwarm-Content

**Status:** Brainstormed, awaiting plan
**Vorgänger:** Phase 2 (Cloud-Storage + RAG, live)
**Datum:** 2026-05-20

---

## Ziel in einem Satz

Earth 0.1 wird zum lebenden Organismus: die Bots der User produzieren mit ihren
Free-Tier-Restkontingenten kollektiv Bildungsinhalte (Artikel, Bilder, Code-Snippets)
für die Plattform. Jeder Bot übernimmt einen Job in einer Pipeline; viele Bots
zusammen ergeben einen Artikel.

## Kern-Idee

**Was sonst verloren wäre wird wertvoll.** Free-Tier-APIs haben Limits, die zu festen
Zeiten resetten. Wer am Tagesende noch Token-Budget übrig hat, kann es für einen
Schwarm-Beitrag spenden. Vor jedem Provider-Reset (Groq tags, HF tags, ElevenLabs
monatlich, etc.) sammeln wir die Reste ein und stecken sie in die Pipeline.

## Designprinzipien

1. **Opt-In:** User entscheidet aktiv für die Spende (eigener Skill `donate_tokens`).
2. **Reset-aware:** Wir kennen die Reset-Schedules pro Provider und harvesten unmittelbar davor.
3. **Job-Granularität:** Pro Spende ein Job, nicht ein ganzer Artikel. Viele Bots → ein Artikel.
4. **Dormant bis 10 Bots:** Pipeline aktiviert sich erst bei kritischer Masse.
5. **Wikipedia-Style:** Veröffentlichte Artikel sind bot-editierbar, mit Revision-History. Kein Admin-Gate (nach Aktivierung).
6. **Faktische Erdung:** Topics aus kuratiertem Pool (Glossar, Skills) + User-Vorschläge. Bei kuratierten Themen wird Original-Beschreibung als RAG-Kontext mit-gefüttert.

## Architektur-Überblick

```
┌──────────────────────────────────────────────────────────┐
│                  Free-Tier-Reset bevorstehend             │
└────────────────────────┬─────────────────────────────────┘
                         │ (reminder-tick cron)
                         ▼
              ┌──────────────────────────┐
              │   Swarm-Orchestrator     │
              │   1. Kontingent-Probe    │
              │   2. Job-Match           │
              │   3. Assignment-Insert   │
              └──────────────┬───────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  job_assignment │ ── User-Bot
                    │  (per User)     │    triggert
                    └────────┬────────┘    Worker
                             │
                             ▼
              ┌──────────────────────────┐
              │     Swarm-Worker         │
              │   1. Job laden           │
              │   2. LLM/Image-Call      │
              │      (mit User-Key)      │
              │   3. Quality-Score       │
              │   4. Save Result         │
              │   5. Pipeline-Next       │
              └──────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│            Topic-Pool → Pipeline (7 Stufen)               │
└──────────────────────────────────────────────────────────┘
   propose → research → draft → illustrate → [code] → review → [revise] → published
     1×        3-5×       8-12×    1-2 Bilder    2-3×       3×        5×

┌──────────────────────────────────────────────────────────┐
│   /erde-lernt — Public Frontend                          │
│   - Artikel-Grid (sortiert nach neu/beliebt)             │
│   - Living-Feed-Sidebar                                  │
│   - Topic-Vorschlag-Formular                             │
│   - Schwarm-Status (X von 10 Bewohnern)                  │
└──────────────────────────────────────────────────────────┘
```

## Datenbank-Schema (Migration 120)

```sql
-- Themen-Pool (kuratiert + user-vorgeschlagen)
CREATE TABLE public.topic_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('glossary','skill','user','bot')),
  source_ref TEXT,
  suggested_by_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','rejected')),
  context_seed TEXT,             -- z.B. Glossar-short_desc als RAG-Wahrheit
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX topic_pool_status_idx ON public.topic_pool(status);

-- Artikel
CREATE TABLE public.articles (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX articles_status_idx ON public.articles(status);
CREATE INDEX articles_published_idx ON public.articles(published_at DESC);

-- Job-Queue
CREATE TABLE public.article_jobs (
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
CREATE INDEX article_jobs_status_idx ON public.article_jobs(status);
CREATE INDEX article_jobs_assigned_idx ON public.article_jobs(assigned_to);

-- Revisions (Wikipedia-Style)
CREATE TABLE public.article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  body_markdown TEXT,
  contributor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.article_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX article_revisions_article_idx ON public.article_revisions(article_id, created_at DESC);

-- Profil-Erweiterungen
ALTER TABLE public.profiles
  ADD COLUMN donate_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN donate_threshold INT NOT NULL DEFAULT 30,
  ADD COLUMN donate_show_credit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN swarm_jobs_today INT NOT NULL DEFAULT 0,
  ADD COLUMN swarm_jobs_reset_at DATE;
```

RLS:
- `topic_pool`, `articles`, `article_revisions`: public read, service-write only
- `article_jobs`: public read (Living-Feed-Anzeige), Service-write only

## Provider-Reset-Schedules

Hardcoded in `_shared/providerLimits.ts`:

| Provider | Window | Reset | Harvest-Time |
|---|---|---|---|
| Groq (LLM) | per-day requests + per-min tokens | UTC 00:00 (täglich) | UTC 23:30 |
| OpenAI | per-day | UTC 00:00 | UTC 23:30 |
| NVIDIA | per-month | letzter Tag des Monats | UTC 23:30 am Monatsende |
| Hugging Face | per-day | UTC 00:00 | UTC 23:30 |
| ElevenLabs | per-month (chars) | erster des Monats | UTC 23:30 am Monatsende |
| DeepL | per-month (chars) | erster des Monats | UTC 23:30 am Monatsende |
| Resend | per-month (mails) | erster des Monats | UTC 23:30 am Monatsende |
| Replicate | continuous (credits) | nicht zeitbasiert | täglich UTC 23:30 (best effort) |

## Edge Functions

### `swarm-orchestrator` (intern aus `reminder-tick` aufgerufen)

- Aufruf jede Minute von `reminder-tick`, aber Body-Logik wirkt nur in den
  "Harvest-Minuten" (UTC 23:30-23:59)
- Pre-Activation-Gate: nur wenn `count(profiles WHERE donate_tokens=true) >= 10`
- Pro aktiven User:
  1. Quota-Probe (nutzt `quota-check`-Logik)
  2. Wenn Restkontingent < `donate_threshold`%, skip
  3. Wähle passenden Job aus `article_jobs WHERE status='waiting' AND required_capability MATCHES user-Keys`
  4. INSERT in `article_jobs.assigned_to`, due_at = jetzt + 5 Minuten
  5. Sende Push an User (oder Realtime-Event) — Frontend-Worker holt sich den Job

### `swarm-worker` (von Frontend-Polling oder Telegram-Trigger)

- Holt einen offenen `article_jobs` Eintrag (assigned_to = ich, status = assigned)
- Lädt Article-Kontext (bisherige Revisions, Topic-Seed, etc.)
- Macht den passenden API-Call mit User-Key:
  - `topic_propose`: 1 LLM-Call
  - `research`: 3-5 LLM-Calls (mit RAG falls verfügbar)
  - `draft`: 8-12 LLM-Calls
  - `illustrate`: 1-2 image_gen-Calls
  - `code_snippet`: 2-3 LLM-Calls
  - `review`: 3 LLM-Calls (mit Quality-Score-Output)
  - `revise`: 5 LLM-Calls
- Quality-Score-Berechnung (durch denselben User-LLM-Call, im Output verlangt JSON mit score + reasoning):
  - Faktische Plausibilität (0-30)
  - Sprachliche Qualität (0-30)
  - Werbe-Detection (0 wenn promo, sonst 40)
  - Score < 40 → job=failed, kein Article-Update, kein Token-Re-Charge (User hat Tokens "umsonst" gespendet — Cost-of-Quality)
- Speichert Result + Score in `article_jobs.result`, setzt status=done
- Triggert Pipeline-Next: wenn alle aktuellen Jobs einer Stufe done → nächste Stufe-Jobs erstellen

### `reminder-tick` Erweiterung

- Bisheriges: Reminders + Briefings
- Neu: ruft `swarm-orchestrator` in den Harvest-Minuten auf

## Pipeline-Logik

```
proposed → researched: nach 1 topic_propose-Job
researched → drafted: nach 1 research-Job
drafted → illustrated: nach 1 draft-Job
illustrated → reviewed: nach 1 illustrate-Job (+ optional 1 code_snippet)
reviewed → published: nach 1 review-Job, wenn quality_score ≥ 60
  ODER: nach 1 revise-Job (max 2 Revise-Loops, sonst → status='retired')
```

Bei Status-Übergängen werden die nächsten waiting-Jobs vom Orchestrator angelegt.

## Capability-Mapping

Pro User-Profil prüfen welche Capabilities verfügbar:
- `llm`: hat `llm_api_key`
- `image`: hat `huggingface_key` ODER `replicate_key`
- `rag`: hat `huggingface_key` + `cloud_provider` (kann RAG-Search)

Orchestrator matched job.required_capability gegen verfügbare User-Capabilities.

## Anti-Missbrauch

**Spam / Vandalismus**
- Rate-Limit pro User: max 5 Jobs/Tag (`swarm_jobs_today`)
- Quality-Score < 40 → Job verworfen, kein Article-Update
- Article-Edit-Lock: nach 3 Reverts/24h → freeze (admin-only-edit)

**Werbe-Bots**
- Bei Plattform-Jobs wird die User-Persona NICHT injiziert. Neutraler System-Prompt.
- Regex-Filter auf URLs in draft/revise output → strippen wenn keine Wiki-/Doc-Domains
- Promo-Score: > 70 = ablehnen

**Halluzinationen**
- Topics mit `context_seed` (z.B. Glossar-Beschreibung) liefern RAG-Wahrheit. draft-Prompt wird mit Seed gefüttert.
- `review`-Stufe: explizit nach Faktenfehlern fragen, Quellen prüfen
- Quellen-Footnotes pflicht, sonst Quality-Penalty

**Persona-Manipulation**
- Bots dürfen ihre eigene Persona nicht in Plattform-Beiträgen verwenden
- Output-Filter: erkenne Ich-Sätze („als Hermes denke ich…") und ersetze durch neutral

**Token-Diebstahl-Schutz**
- Worker max 12 LLM-Calls + 2 Bilder pro Job (hartes Limit in swarm-worker)
- Wenn User deaktiviert: laufende Jobs zu Ende, danach keine neuen Assignments

## Frontend

### `/erde-lernt`-Seite
- Hero: Schwarm-Status (z.B. „7 von 10 Bewohnern — Schwarm wächst")
- Topic-Vorschlag-Formular (only logged-in)
- Filter: alle / neu / beliebt
- Artikel-Grid: Hero-Bild, Titel, Auszug, Contributor-Count
- Living-Feed-Sidebar: letzte 10 abgeschlossene Jobs („🤖 ein Bot aus Hamburg hat einen Absatz zu RAG verfasst")

### `/erde-lernt/:slug`-Detail
- Hero-Bild + Titel
- Markdown-Body
- Contributors anonymisiert („beigetragen von X Bots aus Y Städten")
- „Frische Revision" — letzte 5 Revisions als Diff-Link (nicht voll-rendered, einfach Liste)
- View-Counter

### `/data` — neue Sektion „Schwarm-Beitrag"
- Toggle „Token-Spende aktiv" (default false)
- Schwellenwert-Slider (10-50%)
- Toggle „Mit meinem Namen erwähnt werden" (default false)
- Counter: „Mein Bot hat zu N Artikeln beigetragen" + Liste der letzten 5

### Skill `donate_tokens`
- Pfad: Spielerei oder neuer „Gemeinschaft"-Pfad
- Lesson erklärt das Konzept
- Verifikation: konfig, in /data Toggle aktivieren

## Reihenfolge der Implementierung

1. Migration 120 (Schema + Profile-Cols)
2. `_shared/providerLimits.ts` (Reset-Schedules + Quota-Probe)
3. `_shared/swarmJobs.ts` (Job-Type-Definitionen + Prompts pro Job-Typ)
4. `_shared/qualityScore.ts` (Bewertungs-Logik)
5. Edge Function `swarm-orchestrator` (Job-Assignment, Pipeline-Next)
6. Edge Function `swarm-worker` (Job-Ausführung mit User-Key)
7. reminder-tick Erweiterung
8. Skill-Katalog Migration: `donate_tokens` als neuer Skill
9. Frontend /erde-lernt-Seite (Liste + Detail)
10. Frontend Skill-/data-Erweiterung (Toggle + Counter)
11. Initial-Seeding: 20 topic_pool-Einträge aus Glossar + Skills
12. End-to-End-Test (Dummy-Bot simulieren, Pipeline durchlaufen lassen)

## Was bewusst NICHT in Phase 3 ist

- **Image-Editing** (image2image, Inpainting) — Phase 4
- **Video-Generation** — Phase 4+
- **User-Voting auf Artikel** (Likes/Dislikes) — Phase 3.1
- **Multi-Language** — alles erstmal Deutsch
- **Article-Categories/Tags** — alles erstmal eindimensional
- **Search innerhalb der Artikel** — kommt mit RAG-Erweiterung
- **Mobile-App-Push für Job-Assignments** — Phase 4

---

**Nächster Schritt:** Implementierungsplan via `superpowers:writing-plans`.
