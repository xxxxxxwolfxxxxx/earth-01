# Earth 0.1 — Projekt-Gedächtnis

## Was ist das?

Eine lebende Lernplattform für KI, Code und Programmieren — verpackt als „Earth 0.1",
ein Zuhause für die Telegram-Bots der User. Mit echter 3D-Erde auf der Landing-Page
(NASA-Texturen, echte Sonnenposition, echter Mond, Planeten, Sterne, User-Lichtpunkte
mit Live-Aktivität), Tech-Baum zum Lernen, Skills die Bot-Befehle werden, und einer
Schwarm-Pipeline die abends mit gespendeten Resttokens kollektiv Artikel produziert.

**Stand 2026-05-20:** Phase 3 ist gemerged, Schwarm-Pipeline schläft bis 10 spendende User aktiv sind.

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + react-router-dom + react-globe.gl + three.js + astronomy-engine
- **Backend:** Supabase (PostgreSQL + pgvector + Edge Functions Deno + RLS + Realtime)
- **Auth:** Supabase Auth (GitHub, Google, Email)
- **Deploy:** Netlify → earth-01.netlify.app
- **Bot:** User-eigener Telegram-Bot via @BotFather
- **Code-Splitting:** Alle Routes via React.lazy, LiveEarth eigener Chunk

## Supabase

- Projekt-ID: `giyvmksetvberzrpvuhu`
- URL: `https://giyvmksetvberzrpvuhu.supabase.co`

### Tabellen
| Name | Zweck |
|---|---|
| `profiles` | User + ~35 Spalten (API-Keys, Telegram, Cloud, Persona, Standort, Schwarm, is_admin) |
| `skills` | Skill-Katalog (36 Skills in 7 Pfaden) |
| `user_skills` | Freigeschaltete Skills pro User |
| `lesson_sessions` | Laufende/abgeschlossene Lektionen |
| `glossary` | 34 Begriffe für Mini-Wiki |
| `skill_usage_log` | Nutzungs-Statistik |
| `user_data` | Notizen, Mood, Habits pro User |
| `reminders` | Geplante Pings |
| `platform_settings` | Singleton (Affiliate-Links etc.) |
| `notes_embeddings` | pgvector-Index für RAG (Phase 2) |
| `agent_activity` | Realtime-Pulse für Live-Earth |
| `demo_locations` | 10 Demo-Lichter auf der Earth |
| `briefing_subscriptions` | Tägliches Briefing-Setup |
| `topic_pool` | Schwarm-Pipeline: Artikel-Themen |
| `articles` | Schwarm-Pipeline: Artikel mit Lifecycle-Status |
| `article_jobs` | Schwarm-Pipeline: Job-Queue |
| `article_revisions` | Wikipedia-Style Edit-History |

RLS aktiv auf allen Tabellen. pgvector aktiv für RAG.

## Routes

| Pfad | Datei | Auth | Beschreibung |
|------|-------|------|--------------|
| `/` | `src/pages/Home.jsx` | nein | Landing mit 3D-LiveEarth |
| `/wissen` | `src/pages/Knowledge.jsx` | nein | Konzept-Übersicht, Provider-Tabelle, Live-Glossar |
| `/tech-tree` | `src/pages/TechTree.jsx` | nein | SVG-Tech-Baum mit Hub + 7 Lanes |
| `/lesson/:skillId` | `src/pages/Lesson.jsx` | mixed | 3-Karten-Lektion mit Browser-Demos |
| `/keys` | `src/pages/Keys.jsx` | ja | 13 Service-Keys + Telegram-Status + Quota-Widget |
| `/provider` | `src/pages/Provider.jsx` | nein | 40 Free-Tier-Anbieter + Admin-Affiliate-Editor |
| `/data` | `src/pages/Data.jsx` | ja | Cloud + RAG-Sources + Persona + Briefing + Spende |
| `/erde-lernt` | `src/pages/ErdeLernt.jsx` | mixed | Schwarm-Artikel-Grid + Living-Feed |
| `/erde-lernt/:slug` | `src/pages/ErdeLernt.jsx` | nein | Artikel-Detail |
| `/bot` | `src/pages/BotProfile.jsx` | ja | Mein-Bot-Übersicht (Persona, Skills, Stats, Setup-Status) |
| `/login` | `src/pages/Login.jsx` | nein | OAuth + Email-Login |
| `/auth/callback` | `src/pages/AuthCallback.jsx` | — | OAuth-Redirect |
| `/auth/cloud-callback` | `src/pages/AuthCloudCallback.jsx` | — | Cloud-OAuth-Redirect (Google Drive) |

## Skill-System

Skills haben `verification_type` der den Lesson-Flow bestimmt:
- `action`: User schickt passende Nachricht an Telegram-Bot, Webhook matcht Pattern
- `browser`: Inline-Demo im Browser, User muss interagieren
- `konfig`: Setup-Schritt (Key eintragen, Bot anlegen)

**Skill-Registry:** `supabase/functions/_shared/skillRegistry.ts` — Regex-Patterns für Telegram-Intent-Matching.

**Skill-Handlers:** `supabase/functions/_shared/skillHandlers.ts` — alle action-Handler mit `executeSkill`-Dispatcher.

## Edge Functions

| Funktion | Trigger | Zweck |
|----------|---------|-------|
| `telegram-webhook` | Telegram → POST | Skill-Match + Verifikation + Ausführung + agent_activity-Logging |
| `register-telegram` | Frontend POST | Webhook setzen / Test-Nachricht / Trennen |
| `oauth-cloud` | Frontend POST | Drive-OAuth + Gist-Connect + Disconnect |
| `ingest-file` | Frontend POST | Datei → Cloud + Embedding |
| `quota-check` | Frontend POST | Live-Quota-Status aller Provider |
| `reminder-tick` | pg_cron (jede Minute) | Reminders + Briefings + Schwarm-Orchestrator-Call |
| `swarm-orchestrator` | von reminder-tick aufgerufen | Job-Assignment in Harvest-Minuten, Pipeline-Progression, Activation-Gate |
| `swarm-worker` | Frontend POST | Job-Execution mit User-Key, Quality-Score, Apply auf Artikel |

## Schlüssel-System

Frontend: `src/lib/keyService.js` mit `SERVICE_CATALOG` (13 Services in 6 Kategorien).

Provider-Detection am Key-Prefix:
- `gsk_*` → Groq · `sk-or-*` → OpenRouter · `nvapi-*` → NVIDIA NIM
- `sk-ant-*` → Anthropic · `sk-*` → OpenAI

## Affiliate-System (Admin)

`/provider` zeigt 40 Free-Tier-Anbieter. Admin (`is_admin=true`) kann Affiliate-URLs eintragen.
Gespeichert in `platform_settings.value` unter `key='affiliate_links'` als JSONB.
Aktueller Admin: User `6d2b55e3-8229-435f-9d30-4380f328c2ee` (xxxxwolfxxxx@googlemail.com).

## Live-Earth

`src/components/LiveEarth.jsx` — 3D-Globus mit react-globe.gl:
- ShaderMaterial mit Day-/Night-Blend an echter Sonnenposition
- `src/lib/ephemeris.js` berechnet J2000→Earth-Fixed-Frame Konversion via Greenwich-Sternzeit
- Sonne, Mond, Merkur, Venus, Mars, Jupiter (real positioniert)
- Saturn mit Ringen (Cassini-Lücke via vertex-colors)
- NASA Tycho-Skymap als Hintergrund (echte Konstellationen)
- Realtime auf `agent_activity`-INSERTs: goldene Pulse an User-Standorten
- Lazy-loaded (1.88 MB Chunk), lädt erst auf Home-Page

Mini-Earth im Header: CSS-only via `.mini-earth`-Klasse in `src/index.css` —
konische Gradient + radial Shading + 30s Rotation. Kein JS-Bundle.

## Schwarm-Pipeline (Phase 3, dormant)

7 Job-Typen pro Artikel: topic_propose → research → draft → illustrate → [code_snippet] → review → [revise].
Pro Spende ein Job, viele Bots arbeiten zusammen.

Activation-Gate: 10+ User mit `donate_tokens=true`.
Harvest-Window: UTC 23:30-23:58.
Pro User max 3 Jobs/Tag, Plattform-Tages-Cap 1000 Jobs.

- `_shared/swarmJobs.ts` — Prompts und Pipeline-Logik
- `_shared/qualityScore.ts` — Regex-Promo-Filter + LLM-Self-Score
- `_shared/providerLimits.ts` — Reset-Schedules + Quota-Probe

## Deploy

```bash
cd /Users/matthiasduhrkop/Documents/earth-01

# Frontend
npx vite build && npx netlify deploy --prod --dir=dist

# DB-Migration
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push --linked --include-all

# Edge Function
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <name> \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

## Bekannte Eigenheiten / Tipps

- **DB-Migration**: bei "Remote migration not found"-Fehler `supabase migration repair --status applied 100 ... <letzte> --linked`, dann nochmal pushen.
- **Tailwind 4 dynamische Klassen**: NICHT `bg-${color}-500` schreiben. Lookup-Map mit voller Klassen-Liste.
- **Code-Splitting**: Pages sind alle lazy. LiveEarth ist eigener Chunk und lädt nur auf Home.
- **Telegram-Chat-ID-Init**: Nach Webhook-Setup muss User einmal `/start` an Bot schicken, damit `telegram_chat_id` gespeichert wird.
- **CORS bei Live-Probes**: Manche Provider blockieren Browser-Direkt-Tests. `keyService.testKey` fängt das ab.
- **pg_cron-Limit**: Free-Tier max 2 Jobs. `reminder-tick` belegt einen Slot, orchestriert intern Reminders + Briefings + Schwarm.
- **astronomy-engine + three.js**: bringen ~1.5 MB JS. Daher LiveEarth lazy.
- **Bundle-Größe**: Main bei ~462 KB (134 KB gzipped). LiveEarth-Chunk 1.88 MB nur auf Home.

## Aktueller Stand (2026-05-20)

- **36 Skills** in 7 Pfaden
- **8 Edge Functions** aktiv
- **22 Migrations** (20260518 + 100-122)
- **13 Routes** (inkl. /bot)
- **Live-Earth** mit echter Sonne/Mond/5 Planeten/NASA-Sterne/User-Lichter
- **Schwarm-Pipeline** schläft bis 10+ Bots, dann automatisch aktiv
- **Code-Splitting** — Main ~462 KB, Pages 6-30 KB, LiveEarth 1.88 MB nur auf Home
- **Mini-Earth-Logo** im Header (CSS-only, kein Bundle-Cost)
