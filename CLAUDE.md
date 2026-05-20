# Earth 0.1 — Projekt-Gedächtnis

## Was ist das?

Ein Lernspiel über KI, Agenten und das Internet — verpackt als Tech-Baum. User klicken sich durch
20+ Fähigkeiten in sieben Themen-Pfaden, lernen dabei Konzepte wie Token, Cron oder RAG und
schalten echte Werkzeuge frei, die ihr persönlicher Telegram-Bot ab sofort nutzen kann.

**Vision:** „OpenClaw für alle" — Mobile-first, kostenlos auf Free-Tiers (Supabase + Netlify),
User bringen eigene API-Keys mit. Bildung + funktionierender Agent als Belohnung.

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Edge Functions Deno + RLS + Realtime)
- **Auth:** Supabase Auth (GitHub, Google, Email)
- **Deploy:** Netlify → earth-01.netlify.app
- **Bot:** User-eigener Telegram-Bot via @BotFather

## Supabase

- Projekt-ID: `giyvmksetvberzrpvuhu`
- URL: `https://giyvmksetvberzrpvuhu.supabase.co`
- Access-Token (für CLI): in `docs/superpowers/plans/2026-05-19-phase-c-tool-universe.md`
- DB-Tabellen aktiv:
  - `profiles` — User + API-Keys + Telegram-Bot-Setup + is_admin
  - `skills` — Skill-Katalog (20 MVP-Skills in 7 Pfaden)
  - `user_skills` — Freigeschaltete Skills pro User
  - `lesson_sessions` — Laufende/abgeschlossene Lektionen
  - `glossary` — 28 Begriffe für Mini-Wiki
  - `skill_usage_log` — Nutzungs-Statistik
  - `user_data` — Notizen, Mood, Habits pro User
  - `reminders` — Geplante Pings
  - `platform_settings` — Singleton (Affiliate-Links etc.)
- RLS auf allen Tabellen aktiv

**Alle alten Dynastie-Tabellen (agents, world_state, world_tiles, agent_memory, etc.) sind in Migration 100 gedroppt.**

## Routes

| Pfad | Datei | Beschreibung |
|------|-------|--------------|
| `/` | `src/pages/Home.jsx` | Landing mit Earth-Animation + Starfield |
| `/wissen` | `src/pages/Knowledge.jsx` | Konzept-Übersicht, Provider-Tabelle, Live-Glossar |
| `/tech-tree` | `src/pages/TechTree.jsx` | SVG-Tech-Baum mit Hub + 6 Lanes, Stats, Filter, Hover-Tooltip |
| `/lesson/:skillId` | `src/pages/Lesson.jsx` | 3-Karten-Lektion mit Browser-Demos |
| `/keys` | `src/pages/Keys.jsx` | 13 Service-Keys + Telegram-Status-Panel |
| `/provider` | `src/pages/Provider.jsx` | 40 Free-Tier-Anbieter + Admin-Affiliate-Editor |
| `/login` | `src/pages/Login.jsx` | OAuth + Email-Login |
| `/auth/callback` | `src/pages/AuthCallback.jsx` | OAuth-Redirect-Handler |

## Skill-System (Kern-Architektur)

Skills haben einen `verification_type` der den Lesson-Flow bestimmt:

| Typ | Wie Skill freigeschaltet wird | Beispiele |
|-----|-------------------------------|-----------|
| `action` | User schickt passende Nachricht an Telegram-Bot, Webhook matcht Pattern | weather, web_search, notes, reminder |
| `browser` | Inline-Demo im Browser, User muss interagieren | dice, qr_code, math_practice, hash_tools, password_gen, leak_check |
| `konfig` | Setup-Schritt (Key eintragen, Bot anlegen) | api_keys, telegram, rss |

**Skill-Registry:** `supabase/functions/_shared/skillRegistry.ts` mit Regex-Patterns für Intent-Matching.

**Skill-Handlers:** `supabase/functions/_shared/skillHandlers.ts` mit 11 action-Handlern + `executeSkill`-Dispatcher.

## Edge Functions

| Funktion | Trigger | Zweck |
|----------|---------|-------|
| `telegram-webhook` | Telegram → POST | Skill-Match + Verifikation + Ausführung + Usage-Log |
| `register-telegram` | Frontend POST | Webhook setzen / Test-Nachricht / Trennen |
| `reminder-tick` | pg_cron (jede Minute) | Fällige Reminder versenden, Habit-Streaks prüfen |

## Schlüssel-System

Frontend: `src/lib/keyService.js` mit `SERVICE_CATALOG` (13 Services in 6 Kategorien).

Provider-Detection: am Key-Prefix erkennt das System automatisch den Anbieter und setzt `llm_base_url`+`llm_model`:
- `gsk_*` → Groq
- `sk-or-*` → OpenRouter
- `nvapi-*` → NVIDIA NIM
- `sk-ant-*` → Anthropic
- `sk-*` → OpenAI

Profile-Spalten für Keys: `llm_api_key`, `huggingface_key`, `resend_api_key`, `whisper_key`,
`elevenlabs_key`, `replicate_key`, `stability_key`, `openweather_key`, `deepl_key`,
`brave_search_key`, `newsapi_key`, `pushover_token`, `pushover_user`, `telegram_bot_token`.

## Affiliate-System (Admin)

Plattform-Betreiber (is_admin=true) kann auf `/provider` Affiliate-URLs eintragen.
Gespeichert in `platform_settings.value` unter key='affiliate_links' als JSONB {provider_id: url}.

Aktueller Admin: User `6d2b55e3-8229-435f-9d30-4380f328c2ee` (xxxxwolfxxxx@googlemail.com).

40 Anbieter im Katalog `src/lib/providerCatalog.js`, davon ~10 mit echtem Referral-Programm
(OpenRouter, Replicate, Together, ElevenLabs, Resend, Brevo, Supabase, Netlify, Vercel, Railway).

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

## Branch-Strategie

- `main` — Stabile Version
- `tech-tree-mvp` — Aktuelle Entwicklung (Phase 1 MVP, noch nicht gemerged)

## Wichtige Komponenten

| Datei | Zweck |
|-------|-------|
| `src/components/Earth.jsx` | Animierte Erde auf Landing |
| `src/components/Starfield.jsx` | Sternenhintergrund (auf allen Seiten außer Landing) |
| `src/components/Navigation.jsx` | Top-Nav mit Auth-Anzeige |
| `src/components/Footer.jsx` | Footer mit Plattform-Links |
| `src/components/MiniWiki.jsx` | Klickbare Glossar-Tooltips (TermText-Wrapper) |
| `src/lib/skillService.js` | Skill + Lesson + Glossary DB-Zugriff |
| `src/lib/keyService.js` | API-Key-Verwaltung + Provider-Detection + Telegram-Action |
| `src/lib/platformSettings.js` | Admin-Settings (Affiliate-Links) |
| `src/lib/providerCatalog.js` | 40 Free-Tier-Anbieter |
| `src/lib/botMessages.js` | Zentralisierte „Bot-als-Subjekt"-Strings |

## Sprachregelung

Der Bot wird konsequent als Subjekt formuliert („dein Bot kann ab sofort…", „er pingt dich
pünktlich"), nicht als unsichtbares System („wir hören mit", „die Plattform sendet"). Strings in
`src/lib/botMessages.js` und `supabase/functions/_shared/botMessages.ts`.

## Bekannte Eigenheiten / Tipps

- **DB-Migration**: Nutze `--include-all` weil lokale `migration_list` leer ist (CLI-Bug).
- **Tailwind 4 + dynamische Klassen**: Niemals `bg-${color}-500` schreiben — Tailwind sieht das
  nicht zur Build-Zeit. Stattdessen Lookup-Map mit voller Klassen-Liste.
- **CORS bei Live-Tests**: Manche Provider blockieren Browser-Direkt-Tests. `keyService.testKey`
  fängt das ab und gibt „Gespeichert (CORS verhindert Live-Test)" zurück.
- **Telegram-Webhook-Secret**: Wird beim Token-Speichern auf /keys automatisch generiert und in
  `telegram_webhook_secret` gespeichert. URL: `${SUPABASE_URL}/functions/v1/telegram-webhook?secret=...`
- **First-Login-Chat**: Nach Webhook-Setup muss User einmal `/start` an den Bot schicken, damit
  `telegram_chat_id` gespeichert wird. Erst dann kann der Bot antworten.
- **pg_cron-Limit**: Free-Tier maximal 2 Jobs. `reminder-tick` belegt einen Slot.

## Aktueller Stand

- Phase 1 MVP gebaut: Landing, Wissen, Tech-Tree, Lesson, Keys, Provider, Telegram-Auto-Setup
- 20 Skills im Katalog, 28 Glossar-Begriffe, 40 Provider gelistet
- Affiliate-Manager funktioniert, aber noch keine Affiliate-IDs eingetragen (kommt später vom User)
- Auf Branch `tech-tree-mvp`, noch nicht gemerged
- Live-Smoke-Test (Login → Telegram → Skill freischalten) noch nicht durchgeführt
