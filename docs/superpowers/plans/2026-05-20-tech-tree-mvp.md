# Tech-Tree MVP — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Earth 0.1 wird von Dynastie-Simulation zur Tech-Tree-Bildungsplattform. 20 Skills aus 7 Pfaden, Hub im Zentrum, 3-Karten-Lesson-Flow, Mini-Wiki-Tooltips. Alte Welt-Code wird gelöscht.

**Architecture:** Fresh-Start auf neuem `tech-tree-mvp`-Branch. DB-Schema komplett ersetzt. Neue React-Pages (`/tech-tree`, `/lesson/:skillId`, `/keys`). Skill-Engine als Edge-Function-Module. Skript-Skills laufen wo möglich im Browser direkt (kein Server-Call). Telegram-Webhook verifiziert Lesson-Aktionen via Pattern-Match.

**Tech Stack:** React 19 + Vite + Tailwind 4 (vorhanden), Supabase Edge Functions Deno (vorhanden), Supabase Postgres mit RLS (vorhanden). Keine neuen npm-Deps.

**Testing-Strategy:** Projekt hat keine Unit-Test-Infrastruktur — jede Task hat manuelle Verifikation per SQL-Query, curl, oder Browser-Check.

---

## File Structure

**Neu (Backend):**
- `supabase/migrations/100_platform_base.sql` — komplette Schema-Reset
- `supabase/migrations/101_skill_catalog_seed.sql` — 20 Skills
- `supabase/migrations/102_glossary_seed.sql` — 28 Begriffe
- `supabase/functions/_shared/skillRegistry.ts` — Pattern-Mapping
- `supabase/functions/_shared/skillHandlers.ts` — 20 Handler
- `supabase/functions/_shared/botMessages.ts` — Bot-Sprache zentral

**Neu (Frontend):**
- `src/lib/skillService.js` — Skill-API
- `src/lib/botMessages.js` — Bot-Sprache zentral (Frontend)
- `src/pages/TechTree.jsx` — Hub + 7 Pfade
- `src/pages/Lesson.jsx` — 3-Karten-Flow
- `src/pages/Keys.jsx` — Key-Setup
- `src/components/SkillNode.jsx` — SVG-Knoten
- `src/components/LessonCard.jsx` — wiederverwendbare Karte
- `src/components/MiniWiki.jsx` — Glossar-Tooltip
- `src/components/PathLegend.jsx` — Pfad-Legende

**Modifiziert:**
- `supabase/functions/telegram-webhook/index.ts` — neu geschrieben (Lesson-Verifikation + Skill-Dispatch)
- `supabase/functions/reminder-tick/index.ts` — vereinfacht
- `src/App.jsx` — Routen erneuert
- `src/components/Navigation.jsx` — Links neu
- `src/lib/keyService.js` — schon vorhanden, bleibt unverändert (Auto-Detect ist drin)
- `src/lib/supabase.js` — bleibt
- `src/contexts/AuthContext.jsx` — bleibt
- `src/pages/Home.jsx` — bleibt (Landing)
- `src/pages/Login.jsx`, `AuthCallback.jsx`, `Knowledge.jsx` — bleiben
- `src/components/Earth.jsx`, `Starfield.jsx`, `Footer.jsx` — bleiben

**Gelöscht (komplette Liste in Task 1):**
- Alle Dynastie-/Sim-/Roguelite-Komponenten und -Pages
- Alle Migrations außer der ersten und der neuen 100/101/102
- Alle Sim-Edge-Functions

---

## Konventionen

- Branch: `tech-tree-mvp` ab main
- Commits: `<bereich>: <kurz>` (z.B. `db: schema reset`, `feat: lesson flow`, `ui: tech tree svg`)
- Deploy DB: `cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked`
- Deploy Edge Function: `cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy <name> --project-ref giyvmksetvberzrpvuhu --no-verify-jwt`
- Build: `cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build`
- Production-Deploy: `npx netlify deploy --prod --dir=dist`
- Trailing in jedem Commit: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## Task 1: Branch + Lösch-Aktion alter Code

**Files:** ~50 Dateien gelöscht (alte Sim-Welt), Branch erstellt.

- [ ] **Step 1: Feature-Branch anlegen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git checkout main && git checkout -b tech-tree-mvp
```

Expected: `Switched to a new branch 'tech-tree-mvp'`.

- [ ] **Step 2: Frontend-Code löschen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && rm -f \
  src/components/AchievementGrid.jsx \
  src/components/AgentChat.jsx \
  src/components/AgentConfigurator.jsx \
  src/components/AgentDetailPanel.jsx \
  src/components/CharacterHUD.jsx \
  src/components/DeathModal.jsx \
  src/components/DynastyCreator.jsx \
  src/components/FamilyTicker.jsx \
  src/components/LLMConfig.jsx \
  src/components/Leaderboard.jsx \
  src/components/QuestPanel.jsx \
  src/components/TechTreePanel.jsx \
  src/components/TelegramSetup.jsx \
  src/components/WebChat.jsx \
  src/components/WorldCanvas.jsx \
  src/components/WorldEventFeed.jsx \
  src/components/WorldGlobe.jsx \
  src/components/WorldStats.jsx \
  src/pages/Chronik.jsx \
  src/pages/Configurator.jsx \
  src/pages/Dashboard.jsx \
  src/pages/World.jsx \
  src/lib/agentBrain.js \
  src/lib/familyUtils.js \
  src/lib/hexUtils.js \
  src/lib/landMask.js \
  src/lib/llmAdapters.js \
  src/lib/questDefinitions.js \
  src/lib/worldService.js \
  src/contexts/WorldContext.jsx && rm -rf src/components/chronik
```

Verify:
```bash
ls src/pages/ src/components/
```
Expected: nur `Home.jsx`, `Login.jsx`, `AuthCallback.jsx`, `Knowledge.jsx` in pages; nur `Earth.jsx`, `Footer.jsx`, `Navigation.jsx`, `Starfield.jsx` in components.

- [ ] **Step 3: Edge-Functions löschen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && rm -rf \
  supabase/functions/get-world-snapshot \
  supabase/functions/reflection-weekly \
  supabase/functions/simulation-tick \
  supabase/functions/spawn-agent \
  supabase/functions/suggest-action \
  supabase/functions/webchat-respond
```

Auch die `_shared`-Dateien aus alten Phasen entfernen:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && rm -f \
  supabase/functions/_shared/dynasty.ts \
  supabase/functions/_shared/telegram.ts \
  supabase/functions/_shared/toolHandlers.ts \
  supabase/functions/_shared/toolRegistry.ts
```

Verify:
```bash
ls supabase/functions/
```
Expected: nur `_shared`, `register-telegram`, `reminder-tick`, `telegram-webhook`, `unregister-telegram`.

- [ ] **Step 4: Migrations löschen (außer initial_schema)**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && rm -f \
  supabase/migrations/002_telegram_flex_rhythm.sql \
  supabase/migrations/003_memory_system.sql \
  supabase/migrations/004_per_user_llm.sql \
  supabase/migrations/005_agent_reminders.sql \
  supabase/migrations/006_freeciv_upgrade.sql \
  supabase/migrations/007_quest_progression.sql \
  supabase/migrations/008_wildlife_hunting.sql \
  supabase/migrations/009_dynasty_redesign.sql \
  supabase/migrations/010_achievement_catalog.sql \
  supabase/migrations/011_phase_c_tools.sql
```

- [ ] **Step 5: Restl. Verschmutzung in lib aufräumen**

`src/lib/keyService.js` bleibt (hat schon Auto-Detect). `src/lib/supabase.js` bleibt.

Erstelle Platzhalter-Datei für die später kommende skillService:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && touch src/lib/skillService.js
```

- [ ] **Step 6: App.jsx auf Minimum reduzieren** (damit Build nicht bricht)

Write `src/App.jsx`:

```jsx
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AuthProvider>
      {!isHome && <Starfield />}
      <Navigation />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wissen" element={<Knowledge />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  )
}
```

- [ ] **Step 7: Navigation.jsx Links anpassen**

Read current `src/components/Navigation.jsx` and replace links so it only has Home + Wissen for now. Tech-Tree/Keys-Links kommen in Task 14.

Beispielanpassung — finde das Links-Array (`const links = [...]`) und ersetze durch:
```jsx
const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/wissen', label: 'Wissen', icon: BookOpen },
]
```
(Behalte die existierenden Imports von lucide-react die noch verwendet werden; entferne Imports zu Eye, Cpu, ScrollText, LayoutGrid wenn sie nicht mehr genutzt werden.)

- [ ] **Step 8: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: ✓ built in <Xms ohne Fehler. Wenn Fehler bzgl. fehlender Imports kommen: die entsprechenden Imports in Home.jsx oder anderen verbliebenen Dateien suchen und entfernen.

- [ ] **Step 9: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add -A && git commit -m "$(cat <<'EOF'
chore: lösche Dynastie/Sim/Roguelite-Code

Frischer Start für Tech-Tree-Plattform. Behalten werden nur:
Landing-Page, Auth, Wissen, Navigation, Footer, Earth/Starfield,
Tailwind/Vite/Supabase-Config, keyService.js.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: DB-Schema Reset (Migration 100)

**Files:**
- Create: `supabase/migrations/100_platform_base.sql`

- [ ] **Step 1: Migration schreiben**

Write `supabase/migrations/100_platform_base.sql`:

```sql
-- 100_platform_base.sql
-- Komplette Schema-Erneuerung für Tech-Tree-Plattform.
-- Droppt alle Tabellen aus Phase A/B/C der alten Welt.

-- ─── Cleanup alte Tabellen ────────────────────────────────
DROP TABLE IF EXISTS public.alliances CASCADE;
DROP TABLE IF EXISTS public.world_tech CASCADE;
DROP TABLE IF EXISTS public.world_events CASCADE;
DROP TABLE IF EXISTS public.agent_messages CASCADE;
DROP TABLE IF EXISTS public.agent_reminders CASCADE;
DROP TABLE IF EXISTS public.agent_memory CASCADE;
DROP TABLE IF EXISTS public.agent_actions CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.world_tiles CASCADE;
DROP TABLE IF EXISTS public.world_state CASCADE;
DROP TABLE IF EXISTS public.dynasty_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.tool_usage_log CASCADE;
DROP TABLE IF EXISTS public.user_lists CASCADE;

-- ─── profiles erweitern (Tabelle existiert aus initial_schema) ─
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS llm_api_key TEXT,
  ADD COLUMN IF NOT EXISTS llm_base_url TEXT,
  ADD COLUMN IF NOT EXISTS llm_model TEXT,
  ADD COLUMN IF NOT EXISTS groq_api_key TEXT,
  ADD COLUMN IF NOT EXISTS huggingface_key TEXT,
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS gdrive_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gdrive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS github_pat TEXT,
  ADD COLUMN IF NOT EXISTS github_repo TEXT,
  ADD COLUMN IF NOT EXISTS preferred_storage TEXT DEFAULT 'platform';

-- alte Spalten dropen (waren in Phase A/B/C)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS main_agent_id,
  DROP COLUMN IF EXISTS dynasty_name,
  DROP COLUMN IF EXISTS dynasty_emoji,
  DROP COLUMN IF EXISTS dynasty_generation,
  DROP COLUMN IF EXISTS dynasty_started_at,
  DROP COLUMN IF EXISTS shared_llm_calls_today,
  DROP COLUMN IF EXISTS shared_llm_reset_at;

-- ─── Skill-Katalog ────────────────────────────────────────
CREATE TABLE public.skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('hub','daten','sicherheit','tracking','llm','automation','cloud','spielerei')),
  skill_type TEXT NOT NULL CHECK (skill_type IN ('script','llm','workflow','config')),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('action','browser','konzept','konfig')),
  description TEXT NOT NULL,
  how_it_works TEXT NOT NULL,
  token_cost_estimate TEXT NOT NULL DEFAULT '0',
  requires JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  pattern TEXT,
  display_x INT NOT NULL,
  display_y INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_read_all" ON public.skills FOR SELECT USING (true);

-- ─── Glossar ──────────────────────────────────────────────
CREATE TABLE public.glossary (
  key TEXT PRIMARY KEY,
  icon TEXT,
  category TEXT NOT NULL,
  short_desc TEXT NOT NULL,
  example TEXT,
  related JSONB NOT NULL DEFAULT '[]'::jsonb,
  more_skill_id TEXT REFERENCES public.skills(id)
);

ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glossary_read_all" ON public.glossary FOR SELECT USING (true);

-- ─── Lesson-Sessions (laufende und abgeschlossene Lern-Sitzungen) ─
CREATE TABLE public.lesson_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES public.skills(id),
  state TEXT NOT NULL DEFAULT 'concept' CHECK (state IN ('concept','task','verified','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_lesson_sessions_user_skill ON public.lesson_sessions(user_id, skill_id, state);
CREATE INDEX idx_lesson_sessions_open ON public.lesson_sessions(user_id) WHERE state = 'task';

ALTER TABLE public.lesson_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_owner_select" ON public.lesson_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lesson_owner_insert" ON public.lesson_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lesson_owner_update" ON public.lesson_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lesson_service_all" ON public.lesson_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── User-Skills (was hat der User freigeschaltet) ────────
CREATE TABLE public.user_skills (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES public.skills(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_skills_owner_select" ON public.user_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_skills_service_all" ON public.user_skills FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Skill-Nutzungs-Log (für quota_view + Rate-Limit) ──────
CREATE TABLE public.skill_usage_log (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 1,
  tokens_consumed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, skill_id, date)
);

ALTER TABLE public.skill_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_log_owner_select" ON public.skill_usage_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usage_log_service_all" ON public.skill_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── User-Storage (kleine Notizen / Listen / Mood / Habits) ─
CREATE TABLE public.user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, namespace, key)
);

CREATE INDEX idx_user_data_ns ON public.user_data(user_id, namespace, created_at DESC);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_data_owner_all" ON public.user_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_data_service_all" ON public.user_data FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Reminders (vereinfacht ggü. alter Schema) ────────────
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  source_skill TEXT NOT NULL DEFAULT 'reminder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_pending ON public.reminders(remind_at) WHERE delivered = false;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_owner_all" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_service_all" ON public.reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Migration anwenden**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked --include-all
```

Expected: Migration läuft durch, alle alten Tabellen gedroppt, neue erstellt.

- [ ] **Step 3: Verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT to_regclass('public.skills'), to_regclass('public.glossary'), to_regclass('public.lesson_sessions'), to_regclass('public.user_skills'), to_regclass('public.user_data'), to_regclass('public.reminders'), to_regclass('public.agents')" --linked
```

Expected: erste 6 sind nicht-null, `agents` ist NULL (gedroppt).

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('llm_api_key','telegram_bot_token','gdrive_refresh_token','github_pat') ORDER BY column_name" --linked
```

Expected: 4 Spalten gefunden.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/100_platform_base.sql && git commit -m "$(cat <<'EOF'
db: Schema-Reset auf Tech-Tree-Plattform

Droppt alle Tabellen des Dynastie/Sim/Roguelite-Konzepts.
profiles wird um Storage-Tokens (gdrive, github) erweitert.
Neue Tabellen: skills, glossary, lesson_sessions, user_skills,
skill_usage_log, user_data, reminders.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Skill-Katalog seeden (Migration 101)

**Files:**
- Create: `supabase/migrations/101_skill_catalog_seed.sql`

- [ ] **Step 1: Seed-Migration schreiben**

Write `supabase/migrations/101_skill_catalog_seed.sql`:

```sql
-- 101_skill_catalog_seed.sql
-- 20 Skills aus 7 Pfaden (MVP Phase 1)

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works, token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
-- HUB
('api_keys', 'API-Keys verwalten', '🔑', 'hub', 'config', 'konfig',
 'Du hinterlegst kostenlose Schlüssel bei Anbietern wie Groq oder Hugging Face. Diese sind Voraussetzung für Sprachmodelle, Bild-Generation und mehr.',
 'Du fügst deine Keys über ein Formular ein. Sie werden sicher in deinem persönlichen Bereich gespeichert und nur an den jeweiligen Dienst weitergeleitet — niemand sonst sieht sie.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 60, 320, 1),

('telegram', 'Telegram-Bot verbinden', '🤖', 'hub', 'config', 'konfig',
 'Du erstellst deinen eigenen Telegram-Bot kostenlos in 3 Minuten und steckst seinen Schlüssel hier ein. Dann schreibst du deinem Agenten in Telegram.',
 'Eine Anleitung führt dich durch @BotFather. Den Bot-Schlüssel trägst du ein, ein <span class="term">Webhook</span> auf der Plattform nimmt deine Nachrichten an.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 60, 380, 2),

-- DATEN
('weather', 'Wetter', '🌤️', 'daten', 'script', 'action',
 'Frag deinen Agenten nach dem Wetter in einer Stadt — er antwortet mit Temperatur, Wind und einer kurzen Beschreibung.',
 'Skript ruft zwei kostenlose Dienste auf: Geocoding wandelt den Ortsnamen in Koordinaten, Forecast liefert aktuelle Daten. Du lernst dabei was eine <span class="term">REST-API</span> ist.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/wetter|wie ist das wetter|wetter in)', 280, 50, 10),

('web_search', 'Web-Suche', '🔍', 'daten', 'script', 'action',
 'Stelle Wissensfragen — der Agent sucht im Web und gibt eine kurze Zusammenfassung.',
 'Skript fragt DuckDuckGo Instant Answer ab — eine direkte API ohne Suchergebnisse zum Klicken. Schnell, kostenlos, ohne <span class="term">Token</span>-Verbrauch.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/such|^suche\\s|^finde\\s|was bedeutet)', 420, 40, 11),

('wikipedia', 'Wikipedia-Lookup', '📖', 'daten', 'script', 'action',
 '„Was ist X?" — der Agent liefert dir eine Kurzfassung aus Wikipedia.',
 'Skript ruft Wikipedia''s öffentliche <span class="term">REST-API</span> auf und holt die Kurzbeschreibung des Themas. Unbegrenzt, kostenlos.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/wiki|^wikipedia\\s|^was ist\\s)', 560, 60, 12),

('currency', 'Wechselkurse', '💱', 'daten', 'script', 'action',
 '„Wie viel sind 50 USD in EUR?" — aktuelle Wechselkurse von der EZB.',
 'Skript ruft frankfurter.app — eine kostenlose API die EZB-Daten ausgibt. Kein Login, kein Key.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/kurs|wechselkurs|wie viel\\s+\\d+\\s+\\w+\\s+in)', 420, 100, 13),

('countries', 'Länder-Info', '🌍', 'daten', 'script', 'action',
 'Einwohnerzahl, Hauptstadt, Flagge, Sprachen eines Landes — sofort verfügbar.',
 'Skript fragt RestCountries.com ab — kostenlose strukturierte Geo-Daten. Sehr schnell, kein <span class="term">Token</span>-Verbrauch.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/land|info zu (deutschland|frankreich|spanien|italien|polen|österreich|schweiz)|hauptstadt von)', 560, 120, 14),

('rss', 'RSS-Reader', '📰', 'daten', 'config', 'konfig',
 'Abonniere RSS-Feeds beliebiger Webseiten. Bei neuen Einträgen pingt dich dein Bot.',
 'Du gibst eine Feed-URL ein, die Plattform prüft alle 30 Min auf neue Einträge und schickt sie als Telegram-Nachricht. Du lernst dabei <span class="term">RSS</span>, ein offenes Web-Standard-Format.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, NULL, 700, 80, 15),

-- SICHERHEIT
('hash_tools', 'Hash & UUID', '🆔', 'sicherheit', 'script', 'browser',
 'Erzeuge SHA-256-Hashes oder UUIDs für deine Projekte.',
 'Browser-eigene Crypto-API rechnet die Werte aus. Lehrt: kryptografische <span class="term">Hash-Funktionen</span> und ihre Anwendungen.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 280, 170, 20),

('password_gen', 'Passwort-Generator', '🔐', 'sicherheit', 'script', 'browser',
 'Erzeuge sichere Passwörter mit konfigurierbarer Länge und Zeichensatz.',
 'Browser-eigene <span class="term">Crypto-Random</span>-Funktion liefert echte Entropie. Lehrt: warum Passwort-Länge wichtiger ist als Sonderzeichen.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 420, 200, 21),

('leak_check', 'Passwort-Leak-Check', '🚨', 'sicherheit', 'script', 'browser',
 'Wurde dein Passwort schon mal geleakt? Sichere Prüfung ohne dass jemand dein Passwort sieht.',
 'HaveIBeenPwned mit <span class="term">k-Anonymity</span>: nur die ersten 5 Zeichen des Hashes werden gesendet, das echte Passwort bleibt bei dir.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 560, 200, 22),

-- TRACKING
('notes', 'Notizen & Listen', '📝', 'tracking', 'script', 'action',
 'Speichere Notizen, Listen, Ideen — schreib einfach in Telegram „notiz: Milch kaufen".',
 'Skript erkennt das Schlüsselwort und legt die Notiz in deiner persönlichen Datenablage ab. Du lernst dabei das Konzept einer einfachen Datenbank.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/notiz|^notiz:|^liste:)', 280, 290, 30),

('mood', 'Stimmungs-Tracker', '😊', 'tracking', 'script', 'action',
 'Täglich kurz „Stimmung: 4/5" — am Wochenende kriegst du eine Auswertung mit Trend.',
 'Skript parst die Zahl, speichert sie zeitlich. Am Sonntag rechnet ein <span class="term">Cron-Job</span> den Wochenschnitt aus.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/stimmung|^stimmung:|^mood:)\\s*(\\d)', 420, 290, 31),

('habits', 'Gewohnheits-Tracker', '💪', 'tracking', 'script', 'action',
 'Halte Gewohnheiten fest: „heute meditiert" / „heute Sport gemacht". Streak wird gezählt.',
 'Skript prüft jeden Tag um Mitternacht ob du eingetragen hast und berechnet deinen <span class="term">Streak</span>. Bei Bruch sanfte Erinnerung am nächsten Tag.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/habit|^habit:|^heute\\s+\\w+\\s+gemacht|geübt)', 560, 310, 32),

-- AUTOMATION
('reminder', 'Erinnerungen', '⏰', 'automation', 'script', 'action',
 'Sag dem Bot „in 30 min erinnere mich an Yoga" — er pingt dich pünktlich.',
 'Skript parst Zahl + Zeiteinheit + Text. Eintrag in Reminder-Tabelle. Ein <span class="term">Cron-Job</span> prüft jede Minute fällige Reminder.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/erinner|in\\s+\\d+\\s+(min|stunde|h)\\s)', 280, 400, 40),

('pomodoro', 'Pomodoro-Timer', '🍅', 'automation', 'script', 'action',
 'Klassische Pomodoro-Technik: 25 Min Fokus, 5 Min Pause. Bot pingt dich.',
 'Skript startet zwei verkettete Reminder. Lehrt: Zeit-Blocking-Methode + verkettete <span class="term">Cron-Jobs</span>.',
 '0', '["reminder"]'::jsonb, '[]'::jsonb, '(?i)(\\/pomodoro|^pomodoro)', 420, 410, 41),

-- SPIELEREI
('qr_code', 'QR-Code Generator', '📷', 'spielerei', 'script', 'browser',
 'URL oder Text → QR-Code. Direkt im Browser, kein Server.',
 'Browser-eigene Bibliothek rechnet das QR-Muster aus und zeichnet es auf ein Canvas. Lehrt: <span class="term">Reed-Solomon-Fehlerkorrektur</span> in QR-Codes.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 280, 490, 50),

('dice', 'Würfel / Münze / Picker', '🎲', 'spielerei', 'script', 'browser',
 'Wer kocht heute? Welcher Film? Würfel rollt direkt im Browser.',
 'Pure JavaScript-Zufallsfunktion. Lehrt nebenbei: was ist ein <span class="term">Pseudozufalls-Generator</span>.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 420, 500, 51),

('math_practice', 'Mathe-Übungen', '🧮', 'spielerei', 'script', 'browser',
 'Übe Kopfrechnen mit Aufgaben passend zu deinem Level.',
 'Skript generiert Aufgaben prozedural, prüft deine Antwort, tracked deinen Streak. Lehrt: prozedurale Generierung.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 560, 510, 52),

('joke_quote', 'Witz / Zitat des Tages', '😄', 'spielerei', 'script', 'action',
 '„Witz!" → der Bot wirft dir einen kurzen Spruch zu.',
 'Skript greift auf eine kostenlose Witz-API zu (JokeAPI). Bei Fehler fällt es auf eine lokale Sammlung zurück.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\\/witz|\\/joke|^witz|^zitat)', 700, 510, 53)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type,
  verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description,
  how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires,
  required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x,
  display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
```

- [ ] **Step 2: Anwenden + verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT path, COUNT(*) FROM skills GROUP BY path ORDER BY path" --linked
```

Expected: 8 Pfade. `hub=2, daten=6, sicherheit=3, tracking=3, automation=2, spielerei=4` — total 20.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/101_skill_catalog_seed.sql && git commit -m "$(cat <<'EOF'
db: Skill-Katalog Seed (20 MVP-Skills)

Hub (2) + Daten (6) + Sicherheit (3) + Tracking (3) +
Automation (2) + Spielerei (4) = 20 Skills.
Jeder mit description, how_it_works (mit Glossar-Wörtern),
Voraussetzungen und Pattern für Lesson-Verifikation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Glossar seeden (Migration 102)

**Files:**
- Create: `supabase/migrations/102_glossary_seed.sql`

- [ ] **Step 1: Seed schreiben**

Write `supabase/migrations/102_glossary_seed.sql`:

```sql
-- 102_glossary_seed.sql
-- 28 KI-/Tech-Begriffe für das Mini-Wiki

INSERT INTO public.glossary (key, icon, category, short_desc, example, related, more_skill_id) VALUES
('API', '🔌', 'basics', 'Eine Schnittstelle die zwei Programme miteinander reden lässt. Wenn der Wetterdienst „API hat", kann dein Bot direkt fragen ohne Webseite zu besuchen.', 'OpenWeather, NASA, Wikipedia', '["REST-API","JSON","Endpoint"]'::jsonb, 'weather'),
('REST-API', '🌐', 'basics', 'Die häufigste Art von API. Du fragst per URL etwas, kriegst die Antwort als JSON zurück. Wie eine Speisekarte mit konkreten Bestellungen.', 'GET /api/weather?city=Berlin', '["API","JSON","HTTP"]'::jsonb, 'weather'),
('JSON', '📄', 'basics', 'Ein Format um strukturierte Daten zu transportieren. Computer-lesbar aber auch von Menschen verstehbar.', '{"temp": 8.4, "wind": 12}', '["REST-API","Schema"]'::jsonb, NULL),
('Token', '🪙', 'llm', 'Die kleinste Texteinheit eines Sprachmodells — ungefähr 3-4 Buchstaben. „Hallo" = 1 Token, „außergewöhnlich" = 3 Tokens.', '200 Tokens ≈ 150 Wörter', '["Kontext-Fenster","Token-Budget","Quota"]'::jsonb, 'llm_chat'),
('Kontext-Fenster', '🪟', 'llm', 'Wie viele Tokens ein Sprachmodell „auf einmal lesen" kann. Bei großen Modellen oft 128.000 Tokens (ca. 100.000 Wörter).', 'Llama 3.3 70b: 128k Tokens', '["Token","Prompt"]'::jsonb, 'llm_chat'),
('Prompt', '💭', 'llm', 'Die Frage oder Anweisung die du einem Sprachmodell gibst. Gute Prompts sind klar und enthalten Kontext.', '"Du bist ein Koch. Schlag mir aus diesen Zutaten ein Rezept vor: ..."', '["Prompt-Engineering","Kontext-Fenster"]'::jsonb, 'recipe'),
('Prompt-Engineering', '🛠️', 'llm', 'Die Kunst gute Prompts zu schreiben. Strukturierte Anweisungen, Beispiele, klare Rollen-Definition.', 'Few-Shot, Chain-of-Thought, ReAct', '["Prompt","Token"]'::jsonb, 'recipe'),
('Embedding', '🧮', 'llm', 'Ein Text in eine Liste von Zahlen umwandeln, sodass ähnliche Texte ähnliche Zahlen haben. Basis für semantische Suche.', '"Hund" → [0.23, -0.04, 0.91, ...]', '["RAG","Vektor-Suche"]'::jsonb, 'rag'),
('RAG', '📚', 'llm', 'Retrieval Augmented Generation. Statt das Modell alles wissen zu lassen, gibt man ihm nur passende Dokumente mit. Spart Tokens, holt aktuelle Daten rein.', 'Notiz: „Mein Hund heißt Bello" → bei späterer Frage automatisch dabei', '["Embedding","Kontext-Fenster"]'::jsonb, 'rag'),
('Quantisierung', '⚡', 'llm', 'Sprachmodelle kleiner machen indem ihre Zahlen auf weniger Bits reduziert werden — von 32 auf 4 Bit. Folge: Modell passt auf ein Handy.', 'Llama 3 (16 GB) → quantisiert (~3 GB)', '["Inferenz","WebGPU"]'::jsonb, NULL),
('Inferenz', '🧠', 'llm', 'Der Moment in dem das Modell eine Antwort generiert. Im Gegensatz zum Training. Inferenz ist das was Tokens kostet.', 'Eine Antwort = ein Inferenz-Schritt', '["Token","Quantisierung"]'::jsonb, NULL),
('Hash-Funktion', '🆔', 'sicherheit', 'Verwandelt einen beliebig langen Text in einen kurzen Fingerabdruck. Selbst kleinste Änderungen am Text ergeben einen komplett anderen Hash.', 'SHA-256("hallo") → 2cf2…b54e', '["k-Anonymity","UUID"]'::jsonb, 'hash_tools'),
('k-Anonymity', '🛡️', 'sicherheit', 'Datenschutz-Trick: man sendet nur einen Teil des Hashes (z.B. ersten 5 Zeichen). Der Server liefert alle passenden Treffer, der Client filtert lokal.', 'Bei HaveIBeenPwned: 5 Zeichen → 500 Treffer → dein Passwort bleibt geheim', '["Hash-Funktion"]'::jsonb, 'leak_check'),
('Crypto-Random', '🎲', 'sicherheit', 'Sicherer Zufallszahlen-Generator vom Browser. Anders als Math.random() vorhersagbar — gut für Passwörter und Keys.', 'crypto.getRandomValues(buf)', '["Hash-Funktion"]'::jsonb, 'password_gen'),
('JWT', '📜', 'sicherheit', 'JSON Web Token — ein Login-Ticket das aus 3 Teilen besteht: Header.Payload.Signatur. Im Payload steht wer du bist + bis wann das Ticket gültig ist.', 'eyJhbGciOiJIUzI1NiI…', '["Hash-Funktion","OAuth"]'::jsonb, NULL),
('Cron', '⏰', 'automation', 'Eine Zeitplan-Sprache. „* * * * *" heißt jede Minute, „0 8 * * *" heißt jeden Morgen 8 Uhr.', '0 8 * * 1 = Montags 8 Uhr', '["Webhook","Scheduler"]'::jsonb, 'reminder'),
('Cron-Job', '🔁', 'automation', 'Ein automatisierter Task der zu festen Zeiten läuft. Ohne dass du etwas anstoßen musst.', 'Reminder-Tick läuft jede Minute', '["Cron","Workflow"]'::jsonb, 'reminder'),
('Webhook', '🪝', 'automation', 'Eine URL bei dir die ein externes System anruft wenn etwas passiert. „Sag mir Bescheid wenn neue Nachricht kommt".', 'Telegram → unsere Plattform', '["REST-API"]'::jsonb, 'telegram'),
('OAuth', '🔑', 'sicherheit', 'Ein Verfahren wie du einer App erlaubst auf deinen Account zuzugreifen, ohne dein Passwort zu verraten.', '„Mit Google anmelden"', '["JWT","API"]'::jsonb, NULL),
('Sprachmodell', '🤖', 'llm', 'Auch LLM (Large Language Model). Ein neuronales Netz das auf Sprache trainiert wurde. Erzeugt Wort für Wort eine Antwort.', 'GPT, Claude, Llama, Mistral', '["Token","Inferenz","Quantisierung"]'::jsonb, 'llm_chat'),
('LLM', '🤖', 'llm', 'Kurz für Large Language Model — siehe Sprachmodell.', 'Synonym', '["Sprachmodell"]'::jsonb, 'llm_chat'),
('Endpoint', '📍', 'basics', 'Eine konkrete URL an die du eine API-Anfrage stellst.', 'https://api.example.com/v1/chat', '["REST-API","API"]'::jsonb, NULL),
('Free-Tier', '🆓', 'basics', 'Die kostenlose Nutzungs-Stufe eines Anbieters. Meist mit Limits (z.B. „500 Calls/Tag").', 'Groq Free: ~14.000 Tokens/Min', '["Quota","Rate-Limit"]'::jsonb, NULL),
('Rate-Limit', '🚦', 'basics', 'Eine Begrenzung wie oft du eine API in einer Zeitspanne aufrufen darfst. Bei Überschreitung: HTTP 429.', '10 Calls pro Minute', '["Free-Tier","Quota"]'::jsonb, NULL),
('Quota', '📊', 'basics', 'Dein verbleibendes Kontingent für einen Dienst — Calls, Tokens, MB. Wird zu Reset-Zeitpunkten zurückgesetzt.', '4 von 10 Bildern heute generiert', '["Free-Tier","Rate-Limit","Reset-Fenster"]'::jsonb, NULL),
('Reset-Fenster', '🔄', 'basics', 'Der Zeitpunkt zu dem deine Quota wieder auf voll springt. Meist Mitternacht UTC oder zum vollen Monat.', 'Groq: täglich 00:00 UTC', '["Quota","Rate-Limit"]'::jsonb, NULL),
('Token-Budget', '💰', 'llm', 'Wie viele Tokens du im aktuellen Free-Tier-Fenster noch übrig hast. Sprachmodelle „kosten" Tokens pro Anfrage und Antwort.', '14.000 Tokens/Min bei Groq', '["Token","Quota"]'::jsonb, 'llm_chat'),
('Streak', '🔥', 'spielerei', 'Wie viele Tage du in Folge eine Gewohnheit eingehalten hast. Sichtbarer Fortschritt motiviert.', '7 Tage in Folge meditiert', '[]'::jsonb, 'habits')
ON CONFLICT (key) DO UPDATE SET
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  short_desc = EXCLUDED.short_desc,
  example = EXCLUDED.example,
  related = EXCLUDED.related,
  more_skill_id = EXCLUDED.more_skill_id;
```

- [ ] **Step 2: Anwenden + verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db push --linked
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "SELECT category, COUNT(*) FROM glossary GROUP BY category ORDER BY category" --linked
```

Expected: 5 Kategorien (basics, llm, sicherheit, automation, spielerei), total 28.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/migrations/102_glossary_seed.sql && git commit -m "$(cat <<'EOF'
db: Glossar Seed (28 Begriffe)

Begriffe aus 5 Kategorien: basics, llm, sicherheit, automation,
spielerei. Jeder hat Kurzbeschreibung + Beispiel + verwandte
Begriffe + optionalen Vertiefungs-Skill.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Bot-Messages Modul (Backend + Frontend)

**Files:**
- Create: `supabase/functions/_shared/botMessages.ts`
- Create: `src/lib/botMessages.js`

- [ ] **Step 1: Backend-Modul**

Write `supabase/functions/_shared/botMessages.ts`:

```typescript
// Zentrale Bot-Sprache: Bot ist Subjekt, leicht verspielter Ton.
// Diese Sätze tauchen in Telegram-Antworten und Reminder-Nachrichten auf.

export const BOT = {
  // Lesson-Verifikation
  lesson_detected: (skill: string) => `Dein Bot hat erkannt: du hast '${skill}' angewandt. ✓`,
  lesson_unlocked: (skill: string) => `🎉 '${skill}' ist jetzt freigeschaltet. Zurück zur Plattform um den nächsten Skill zu wählen.`,

  // Reminder
  reminder_set: (mins: number) => `Dein Bot merkt sich das. Er pingt dich in ${mins} Minuten.`,
  reminder_fire: (content: string) => `⏰ Dein Bot erinnert dich:\n\n${content}`,

  // Allgemein
  unknown_command: () => `Dein Bot kennt das noch nicht. Schalt dafür einen passenden Skill auf der Plattform frei.`,
  needs_key: (keyType: string) => `Dein Bot braucht dafür einen ${keyType}-Key. Hinterleg ihn unter /keys.`,
  needs_skill: (skill: string) => `Dein Bot kennt diese Fähigkeit noch nicht. Erlerne erst '${skill}'.`,
  error: () => `Dein Bot ist über einen Stolperstein gefallen. Versuch es nochmal.`,

  // Tool-spezifisch
  weather_no_city: () => `Sag deinem Bot in welcher Stadt — z.B. '/wetter Berlin'.`,
  search_no_query: () => `Was soll dein Bot suchen? Probier '/suche Geschichte des Internets'.`,
};
```

- [ ] **Step 2: Frontend-Modul**

Write `src/lib/botMessages.js`:

```javascript
// Frontend-Pendant zu botMessages.ts (Backend).
// Hier sind Lesson-UI-Texte und Onboarding-Botschaften.

export const BOT_TEXT = {
  // Lesson-Cards
  lesson_card2_waiting: 'Dein Bot wartet. Schreib ihm in Telegram.',
  lesson_card2_browser: 'Probier es jetzt unten — dein Bot übernimmt den Rest.',
  lesson_card2_konfig: 'Trag deinen Schlüssel ein — dein Bot testet ob er funktioniert.',
  lesson_card3_success: 'Geschafft! 🎉',
  lesson_card3_next: 'Nächster Skill →',

  // Tech-Tree-Übersicht
  tree_progress: (done, total) => `${done} von ${total} Fähigkeiten gelernt`,
  tree_path_locked: 'Voraussetzungen erfüllen, dann startet dieser Pfad.',
  tree_no_dynasty: 'Schalte deine ersten Werkzeuge frei — dein Bot lernt dabei.',

  // Keys-Page
  keys_save_ok: 'Schlüssel gespeichert. Dein Bot fühlt sich gleich stärker.',
  keys_test_fail: (provider) => `${provider} sagt: Schlüssel akzeptiert er nicht. Prüf nochmal.`,
  keys_no_key_yet: 'Dein Bot kann noch kein Sprachmodell nutzen. Trag einen kostenlosen Key ein.',

  // Allgemein
  loading: 'Dein Bot zieht Daten…',
  empty_state: 'Hier ist noch nichts. Schalt deinen ersten Skill frei.',
};
```

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/botMessages.ts src/lib/botMessages.js && git commit -m "$(cat <<'EOF'
infra: Bot-Sprache zentralisiert (Frontend + Backend)

botMessages.ts (Backend): Telegram-Antworten + Reminder-Texte.
botMessages.js (Frontend): UI-Texte für Lesson-Cards, Tech-Tree,
Keys-Page. Konsistenter Stil: Bot ist Subjekt, leicht verspielt.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Skill-Registry (Backend)

**Files:**
- Create: `supabase/functions/_shared/skillRegistry.ts`

- [ ] **Step 1: Registry schreiben**

Write `supabase/functions/_shared/skillRegistry.ts`:

```typescript
// Skill-Registry: zentrale Pattern-Liste + Routing
// Wird vom telegram-webhook benutzt um eingehende Nachrichten zu klassifizieren.

export interface SkillMeta {
  id: string;
  path: string;
  pattern?: RegExp;
  requires_keys?: string[];
}

// Pattern stammen aus der DB (Spalte skills.pattern), hier als TS-Kopie.
// Diese Liste muss synchron zur 101_skill_catalog_seed.sql sein.
export const SKILL_REGISTRY: SkillMeta[] = [
  { id: 'weather',       path: 'daten',      pattern: /(\/wetter|wie ist das wetter|wetter in)/i },
  { id: 'web_search',    path: 'daten',      pattern: /(\/such|^suche\s|^finde\s|was bedeutet)/i },
  { id: 'wikipedia',     path: 'daten',      pattern: /(\/wiki|^wikipedia\s|^was ist\s)/i },
  { id: 'currency',      path: 'daten',      pattern: /(\/kurs|wechselkurs|wie viel\s+\d+\s+\w+\s+in)/i },
  { id: 'countries',     path: 'daten',      pattern: /(\/land|info zu (deutschland|frankreich|spanien|italien|polen|österreich|schweiz)|hauptstadt von)/i },
  { id: 'notes',         path: 'tracking',   pattern: /(\/notiz|^notiz:|^liste:)/i },
  { id: 'mood',          path: 'tracking',   pattern: /(\/stimmung|^stimmung:|^mood:)\s*\d/i },
  { id: 'habits',        path: 'tracking',   pattern: /(\/habit|^habit:|^heute\s+\w+\s+gemacht|geübt)/i },
  { id: 'reminder',      path: 'automation', pattern: /(\/erinner|in\s+\d+\s+(min|stunde|h)\s)/i },
  { id: 'pomodoro',      path: 'automation', pattern: /(\/pomodoro|^pomodoro)/i },
  { id: 'joke_quote',    path: 'spielerei',  pattern: /(\/witz|\/joke|^witz|^zitat)/i },
];

// Findet anhand der Nachricht den passenden Skill (oder null).
export function matchSkill(message: string): SkillMeta | null {
  for (const s of SKILL_REGISTRY) {
    if (s.pattern && s.pattern.test(message)) return s;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/skillRegistry.ts && git commit -m "$(cat <<'EOF'
sim: Skill-Registry für Pattern-Matching

matchSkill(message) erkennt aus einer Telegram-Nachricht den
zutreffenden Skill anhand der Regex-Pattern. Synchron zur
101_skill_catalog_seed.sql.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Skill-Handlers (Backend, alle 11 action-skills)

**Files:**
- Create: `supabase/functions/_shared/skillHandlers.ts`

- [ ] **Step 1: Handler-Modul schreiben**

Write `supabase/functions/_shared/skillHandlers.ts`:

```typescript
// Skill-Handler für die 11 action-typ Skills (Telegram-Pattern → Antwort).
// Browser-typ Skills (qr_code, dice, math_practice, hash_tools, password_gen, leak_check)
// werden ausschließlich im Frontend gehandhabt — kein Server-Code nötig.

import { BOT } from "./botMessages.ts";

export interface SkillContext {
  supabase: any;
  user_id: string;
  message: string;
}

export interface SkillResult {
  reply: string;
}

// ─── Pattern B: Web-APIs ──────────────────────────────────

export async function skillWeather(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/wetter|wetter in)\s+(.+)|wie ist das wetter\s+in\s+(.+)/i);
  const city = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!city) return { reply: BOT.weather_no_city() };
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`);
    const gj = await geo.json();
    const place = gj.results?.[0];
    if (!place) return { reply: `Dein Bot konnte '${city}' nicht finden.` };
    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
    const wxj = await wx.json();
    const c = wxj.current ?? {};
    return { reply: `🌤️ ${place.name}: ${c.temperature_2m}°C, Wind ${c.wind_speed_10m} km/h.` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillWebSearch(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/such(?:e)?|finde)\s+(.+)|was bedeutet\s+(.+)/i);
  const q = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!q) return { reply: BOT.search_no_query() };
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`);
    const d = await r.json();
    const abs = d.AbstractText || d.Heading || (d.RelatedTopics?.[0]?.Text ?? "");
    return { reply: abs ? `🔍 ${abs}` : `Dein Bot fand nichts zu '${q}'.` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillWikipedia(ctx: SkillContext): Promise<SkillResult> {
  const match = ctx.message.match(/(?:\/wiki|wikipedia|was ist)\s+(.+)/i);
  const q = (match?.[1] ?? "").trim();
  if (!q) return { reply: `Worum geht's? Probier 'was ist Photosynthese'.` };
  try {
    const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
    if (!r.ok) return { reply: `Dein Bot fand kein Wikipedia-Eintrag zu '${q}'.` };
    const d = await r.json();
    return { reply: `📖 ${d.title}\n\n${d.extract}` };
  } catch (e) {
    return { reply: BOT.error() };
  }
}

export async function skillCurrency(ctx: SkillContext): Promise<SkillResult> {
  // Erwartet: "wie viel sind 50 USD in EUR" oder "/kurs USD EUR"
  const m1 = ctx.message.match(/(?:wie viel\s+sind\s+)?(\d+(?:[.,]\d+)?)\s+([a-zA-Z]{3})\s+in\s+([a-zA-Z]{3})/i);
  const m2 = ctx.message.match(/\/kurs\s+([a-zA-Z]{3})\s+([a-zA-Z]{3})(?:\s+(\d+(?:[.,]\d+)?))?/i);
  const amount = m1 ? parseFloat(m1[1].replace(",", ".")) : (m2 ? parseFloat(m2[3] ?? "1") : 1);
  const from = (m1?.[2] ?? m2?.[1] ?? "").toUpperCase();
  const to = (m1?.[3] ?? m2?.[2] ?? "").toUpperCase();
  if (!from || !to) return { reply: `Probier 'wie viel sind 50 USD in EUR' oder '/kurs USD EUR'.` };
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);
    const d = await r.json();
    const result = d.rates?.[to];
    if (result == null) return { reply: `Dein Bot kennt die Währung nicht: '${from}' oder '${to}'.` };
    return { reply: `💱 ${amount} ${from} = ${result.toFixed(2)} ${to}` };
  } catch {
    return { reply: BOT.error() };
  }
}

export async function skillCountries(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/land|info zu|hauptstadt von)\s+(.+)/i);
  const name = (m?.[1] ?? "").trim();
  if (!name) return { reply: `Welches Land? Probier '/land Frankreich'.` };
  try {
    const r = await fetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(name)}`);
    if (!r.ok) {
      // Fallback: nach Name suchen
      const r2 = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      if (!r2.ok) return { reply: `Dein Bot kennt '${name}' nicht.` };
      const d = await r2.json();
      const c = d[0];
      return { reply: `🌍 ${c.translations?.deu?.common ?? c.name.common}\nHauptstadt: ${c.capital?.[0] ?? "—"}\nEinwohner: ${c.population.toLocaleString("de")}\nSprachen: ${Object.values(c.languages ?? {}).join(", ")}` };
    }
    const d = await r.json();
    const c = d[0];
    return { reply: `🌍 ${c.translations?.deu?.common ?? c.name.common}\nHauptstadt: ${c.capital?.[0] ?? "—"}\nEinwohner: ${c.population.toLocaleString("de")}\nSprachen: ${Object.values(c.languages ?? {}).join(", ")}` };
  } catch {
    return { reply: BOT.error() };
  }
}

export async function skillJokeQuote(_ctx: SkillContext): Promise<SkillResult> {
  try {
    const r = await fetch("https://v2.jokeapi.dev/joke/Any?lang=de&safe-mode");
    const d = await r.json();
    if (d.type === "single") return { reply: `😄 ${d.joke}` };
    if (d.type === "twopart") return { reply: `😄 ${d.setup}\n\n... ${d.delivery}` };
    return { reply: `😄 Witz konnte nicht geladen werden, aber dein Bot bleibt fröhlich!` };
  } catch {
    return { reply: `😄 Warum nehmen Programmierer immer Pullover mit ins Büro? Wegen der Cookies!` };
  }
}

// ─── Tracking: DB-CRUD über user_data ─────────────────────

export async function skillNotes(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/notiz|notiz:|liste:)\s*(.+)/i);
  const content = (m?.[1] ?? "").trim();
  if (!content) {
    // Listen-Modus: zeige letzte 10 Notizen
    const { data } = await ctx.supabase
      .from("user_data")
      .select("value, created_at")
      .eq("user_id", ctx.user_id)
      .eq("namespace", "notes")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!data || data.length === 0) return { reply: `Dein Bot hat noch keine Notizen. Probier 'notiz: Milch kaufen'.` };
    return { reply: `📝 Deine letzten Notizen:\n${data.map((r: any) => `• ${r.value.text}`).join("\n")}` };
  }
  await ctx.supabase.from("user_data").insert({
    user_id: ctx.user_id,
    namespace: "notes",
    key: `${Date.now()}`,
    value: { text: content },
  });
  return { reply: `📝 Notiert: '${content}'.` };
}

export async function skillMood(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/stimmung|stimmung:|mood:)\s*(\d)/i);
  const value = m ? parseInt(m[1]) : null;
  if (!value || value < 1 || value > 5) return { reply: `Sag deinem Bot eine Zahl 1-5. Z.B. 'stimmung: 4'.` };
  await ctx.supabase.from("user_data").insert({
    user_id: ctx.user_id,
    namespace: "mood",
    key: new Date().toISOString().slice(0, 10),
    value: { score: value },
  });
  return { reply: `😊 Stimmung ${value}/5 notiert für heute.` };
}

export async function skillHabits(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:\/habit|habit:)\s*(.+)|heute\s+(.+)\s+gemacht/i);
  const habit = (m?.[1] ?? m?.[2] ?? "").trim();
  if (!habit) return { reply: `Welche Gewohnheit? Probier 'habit: meditiert'.` };
  const today = new Date().toISOString().slice(0, 10);
  await ctx.supabase.from("user_data").upsert({
    user_id: ctx.user_id,
    namespace: "habits",
    key: `${habit}:${today}`,
    value: { habit, date: today },
  }, { onConflict: "user_id,namespace,key" });
  return { reply: `💪 '${habit}' für heute eingetragen.` };
}

// ─── Automation: Reminder / Pomodoro ─────────────────────

export async function skillReminder(ctx: SkillContext): Promise<SkillResult> {
  const m = ctx.message.match(/(?:in\s+)?(\d+)\s+(min|minuten|stunde|stunden|h)\s+(?:erinnere mich an\s+|.*?:\s+)?(.+)/i);
  if (!m) return { reply: `Probier 'in 30 min erinnere mich an Yoga'.` };
  const num = parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const text = m[3].trim();
  const minutes = unit.startsWith("stunde") || unit === "h" ? num * 60 : num;
  const remind_at = new Date(Date.now() + minutes * 60_000).toISOString();
  await ctx.supabase.from("reminders").insert({
    user_id: ctx.user_id,
    content: text,
    remind_at,
    source_skill: "reminder",
  });
  return { reply: BOT.reminder_set(minutes) };
}

export async function skillPomodoro(ctx: SkillContext): Promise<SkillResult> {
  const focus = new Date(Date.now() + 25 * 60_000).toISOString();
  const breakTime = new Date(Date.now() + 30 * 60_000).toISOString();
  await ctx.supabase.from("reminders").insert([
    { user_id: ctx.user_id, content: "Fokus-Block vorbei. 5 Min Pause!", remind_at: focus, source_skill: "pomodoro" },
    { user_id: ctx.user_id, content: "Pause vorbei. Zurück an die Arbeit oder neuen Pomodoro?", remind_at: breakTime, source_skill: "pomodoro" },
  ]);
  return { reply: `🍅 Pomodoro läuft. 25 Min Fokus, dann pingt dich dein Bot.` };
}

// ─── Dispatch ────────────────────────────────────────────

export async function executeSkill(skill_id: string, ctx: SkillContext): Promise<SkillResult> {
  switch (skill_id) {
    case "weather": return skillWeather(ctx);
    case "web_search": return skillWebSearch(ctx);
    case "wikipedia": return skillWikipedia(ctx);
    case "currency": return skillCurrency(ctx);
    case "countries": return skillCountries(ctx);
    case "joke_quote": return skillJokeQuote(ctx);
    case "notes": return skillNotes(ctx);
    case "mood": return skillMood(ctx);
    case "habits": return skillHabits(ctx);
    case "reminder": return skillReminder(ctx);
    case "pomodoro": return skillPomodoro(ctx);
    default: return { reply: BOT.unknown_command() };
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/_shared/skillHandlers.ts && git commit -m "$(cat <<'EOF'
sim: Skill-Handler für 11 action-typ Skills

Web-APIs (Wetter, Web-Suche, Wikipedia, Wechselkurs, Länder,
Witze), DB-CRUD (Notes, Mood, Habits), Automation (Reminder,
Pomodoro). Browser-typ Skills (QR, Dice, Math, Hash, Passwort,
Leak-Check) werden im Frontend gehandhabt.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: telegram-webhook neu (Lesson-Verifikation + Skill-Dispatch)

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts` (komplett überschreiben)

- [ ] **Step 1: Webhook komplett überschreiben**

Write `supabase/functions/telegram-webhook/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchSkill } from "../_shared/skillRegistry.ts";
import { executeSkill } from "../_shared/skillHandlers.ts";
import { BOT } from "../_shared/botMessages.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Webhook-Secret prüfen
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, telegram_bot_token, telegram_chat_id")
    .eq("telegram_webhook_secret", secret)
    .single();
  if (!profile) {
    return new Response(JSON.stringify({ error: "bad secret" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const msg = update?.message;
  if (!msg) return new Response("ok-no-msg", { headers: CORS });

  const text = (msg.text ?? "").trim();
  if (!text) return new Response("ok-no-text", { headers: CORS });

  // chat_id aktualisieren falls noch nicht gesetzt
  if (!profile.telegram_chat_id && msg.chat?.id) {
    await supabase.from("profiles").update({ telegram_chat_id: String(msg.chat.id) }).eq("id", profile.id);
  }

  // Slash-Commands: /start, /help
  if (text === "/start" || text === "/help") {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id,
      `Hallo! Dein Bot lebt. Schalt auf https://earth-01.netlify.app/tech-tree Fähigkeiten frei — danach versteht er die passenden Befehle.`);
    return new Response("ok", { headers: CORS });
  }

  // Skill-Match
  const skill = matchSkill(text);
  if (!skill) {
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, BOT.unknown_command());
    return new Response("ok-no-match", { headers: CORS });
  }

  // Hat User den Skill freigeschaltet?
  const { data: unlocked } = await supabase
    .from("user_skills").select("skill_id").eq("user_id", profile.id).eq("skill_id", skill.id).single();

  if (!unlocked) {
    // Offene Lesson-Session für diesen Skill?
    const { data: session } = await supabase
      .from("lesson_sessions")
      .select("id, state")
      .eq("user_id", profile.id)
      .eq("skill_id", skill.id)
      .eq("state", "task")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();
    if (session) {
      // Lesson-Verifikation: Skill ausführen UND als gelernt markieren
      const ctx = { supabase, user_id: profile.id, message: text };
      const result = await executeSkill(skill.id, ctx);
      await supabase.from("lesson_sessions").update({ state: "verified", completed_at: new Date().toISOString() }).eq("id", session.id);
      await supabase.from("user_skills").insert({ user_id: profile.id, skill_id: skill.id }).select();
      await sendTelegram(profile.telegram_bot_token, msg.chat.id,
        `${result.reply}\n\n✓ Skill '${skill.id}' freigeschaltet — schau auf der Plattform den Tech-Tree an.`);
      return new Response("ok-verified", { headers: CORS });
    }
    // Skill nicht freigeschaltet, keine offene Lesson
    await sendTelegram(profile.telegram_bot_token, msg.chat.id, BOT.needs_skill(skill.id));
    return new Response("ok-locked", { headers: CORS });
  }

  // Skill ist freigeschaltet: einfach ausführen
  const ctx = { supabase, user_id: profile.id, message: text };
  const result = await executeSkill(skill.id, ctx);
  await sendTelegram(profile.telegram_bot_token, msg.chat.id, result.reply);

  // Usage-Log
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("skill_usage_log")
    .select("count")
    .eq("user_id", profile.id).eq("skill_id", skill.id).eq("date", today).single();
  if (existing) {
    await supabase.from("skill_usage_log").update({ count: existing.count + 1 }).eq("user_id", profile.id).eq("skill_id", skill.id).eq("date", today);
  } else {
    await supabase.from("skill_usage_log").insert({ user_id: profile.id, skill_id: skill.id, date: today, count: 1 });
  }

  return new Response("ok", { headers: CORS });
});

async function sendTelegram(token: string | null, chat_id: any, text: string): Promise<void> {
  if (!token || !chat_id) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
    });
  } catch (e) { console.warn("Telegram send failed:", e); }
}
```

- [ ] **Step 2: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy telegram-webhook --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/telegram-webhook/index.ts && git commit -m "$(cat <<'EOF'
sim: telegram-webhook neu — Lesson-Verifikation + Skill-Dispatch

Bot empfängt Nachrichten, matchSkill identifiziert den Skill.
Drei Pfade: (1) Skill nicht freigeschaltet UND keine Lesson →
hinweise auf Plattform. (2) Skill nicht freigeschaltet UND
offene Lesson → ausführen + freischalten. (3) Skill bereits
freigeschaltet → einfach ausführen + Usage loggen.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: reminder-tick aufräumen

**Files:**
- Modify: `supabase/functions/reminder-tick/index.ts`

- [ ] **Step 1: Vereinfachte Version schreiben**

Write `supabase/functions/reminder-tick/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT } from "../_shared/botMessages.ts";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("reminders")
    .select("id, user_id, content")
    .lte("remind_at", now)
    .eq("delivered", false)
    .limit(50);

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), { headers: { "Content-Type": "application/json" }});
  }

  let fired = 0;
  for (const r of due) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("id", r.user_id).single();

    if (profile?.telegram_bot_token && profile?.telegram_chat_id) {
      try {
        await fetch(`https://api.telegram.org/bot${profile.telegram_bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: BOT.reminder_fire(r.content),
            parse_mode: "HTML",
          }),
        });
      } catch (e) { /* swallow */ }
    }
    await supabase.from("reminders").update({ delivered: true }).eq("id", r.id);
    fired++;
  }

  return new Response(JSON.stringify({ fired }), { headers: { "Content-Type": "application/json" }});
});
```

- [ ] **Step 2: Deploy**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase functions deploy reminder-tick --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add supabase/functions/reminder-tick/index.ts && git commit -m "$(cat <<'EOF'
sim: reminder-tick auf neue reminders-Tabelle

Liest aus public.reminders, nicht mehr aus agent_reminders.
Nutzt botMessages für konsistente Sprache.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Skill-Service (Frontend)

**Files:**
- Modify: `src/lib/skillService.js` (war leer aus Task 1)

- [ ] **Step 1: Service-Modul schreiben**

Write `src/lib/skillService.js`:

```javascript
import { supabase } from './supabase'

export async function fetchSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchSkill(id) {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchUserSkills() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('user_skills')
    .select('skill_id, unlocked_at')
    .eq('user_id', user.id)
  return data ?? []
}

export async function fetchGlossary() {
  const { data, error } = await supabase
    .from('glossary')
    .select('*')
  if (error) throw error
  return data ?? []
}

export async function fetchGlossaryEntry(key) {
  const { data } = await supabase
    .from('glossary')
    .select('*')
    .eq('key', key)
    .single()
  return data
}

// Lesson-Session-Management
export async function startLesson(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  // Bestehende offene abandonen
  await supabase
    .from('lesson_sessions')
    .update({ state: 'abandoned' })
    .eq('user_id', user.id)
    .in('state', ['concept', 'task'])
  // Neue erstellen
  const { data, error } = await supabase
    .from('lesson_sessions')
    .insert({ user_id: user.id, skill_id: skillId, state: 'concept' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function advanceLesson(sessionId, newState) {
  const { error } = await supabase
    .from('lesson_sessions')
    .update({ state: newState, completed_at: newState === 'verified' ? new Date().toISOString() : null })
    .eq('id', sessionId)
  if (error) throw error
}

export async function findOpenLesson(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('lesson_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('skill_id', skillId)
    .in('state', ['concept', 'task'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Direkter Browser-Skill-Unlock (für Skripte ohne Server-Verifikation)
export async function markSkillUnlocked(skillId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase
    .from('user_skills')
    .upsert({ user_id: user.id, skill_id: skillId }, { onConflict: 'user_id,skill_id' })
}

// Realtime auf user_skills lauschen (für Auto-Refresh nach Telegram-Verifikation)
export function subscribeUserSkills(onChange) {
  const channel = supabase
    .channel('user-skills-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_skills' }, (payload) => {
      onChange(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
```

- [ ] **Step 2: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/lib/skillService.js && git commit -m "$(cat <<'EOF'
api: skillService Frontend-API

fetch{Skills,UserSkills,Glossary,GlossaryEntry,Skill},
startLesson, advanceLesson, findOpenLesson, markSkillUnlocked,
subscribeUserSkills (Realtime).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: MiniWiki-Komponente (Glossar-Tooltip)

**Files:**
- Create: `src/components/MiniWiki.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/MiniWiki.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { fetchGlossaryEntry } from '../lib/skillService'

// Globaler Cache damit nicht für jedes Tooltip ein Roundtrip nötig ist
const cache = new Map()

async function load(key) {
  if (cache.has(key)) return cache.get(key)
  const data = await fetchGlossaryEntry(key)
  if (data) cache.set(key, data)
  return data
}

export default function MiniWiki({ termKey, anchorRect, onClose }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const tipRef = useRef(null)

  useEffect(() => {
    load(termKey).then(d => { setEntry(d); setLoading(false) })
  }, [termKey])

  useEffect(() => {
    function handleClick(e) {
      if (tipRef.current && !tipRef.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!anchorRect) return null
  const style = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 280),
    top: anchorRect.bottom + 8,
    zIndex: 100,
    maxWidth: 260,
  }

  return (
    <div
      ref={tipRef}
      style={style}
      className="bg-cosmos-900 border border-nebula-400/50 rounded-xl p-3 shadow-2xl"
    >
      {loading && <div className="text-gray-400 text-xs">Lade…</div>}
      {!loading && !entry && (
        <div className="text-gray-500 text-xs">Kein Eintrag zu „{termKey}".</div>
      )}
      {entry && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{entry.icon ?? '📖'}</span>
            <span className="text-white text-sm font-bold">{entry.key}</span>
            <span className="ml-auto text-[9px] uppercase tracking-wide text-nebula-300 bg-nebula-500/20 px-2 py-0.5 rounded-full">{entry.category}</span>
          </div>
          <p className="text-xs text-gray-300 leading-snug mb-2">{entry.short_desc}</p>
          {entry.example && (
            <div className="text-[11px] text-amber-200 bg-black/30 rounded px-2 py-1 mb-2 font-mono">{entry.example}</div>
          )}
          {Array.isArray(entry.related) && entry.related.length > 0 && (
            <div className="text-[10px] text-gray-400">
              Verwandt:{' '}
              {entry.related.map((r, i) => (
                <span key={r} className="text-blue-300">{r}{i < entry.related.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Wrapper-Komponente: rendert Text mit klickbaren <span class="term"> für Glossar-Wörter
export function TermText({ html }) {
  const [active, setActive] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    function onClick(e) {
      const target = e.target
      if (target.matches && target.matches('.term')) {
        const rect = target.getBoundingClientRect()
        setActive({ key: target.textContent.trim(), rect })
      }
    }
    ref.current.addEventListener('click', onClick)
    return () => ref.current?.removeEventListener('click', onClick)
  }, [])

  return (
    <>
      <span ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {active && (
        <MiniWiki termKey={active.key} anchorRect={active.rect} onClose={() => setActive(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/MiniWiki.jsx && git commit -m "$(cat <<'EOF'
ui: MiniWiki Tooltip-Komponente (Glossar)

Klick auf <span class="term">Wort</span> öffnet Tooltip mit
Beschreibung, Beispiel, verwandten Begriffen. Globaler Cache
verhindert Roundtrips. TermText-Wrapper akzeptiert HTML und
verdrahtet die Klick-Handler automatisch.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: TechTree-Page (SVG-Rendering)

**Files:**
- Create: `src/pages/TechTree.jsx`

- [ ] **Step 1: Page schreiben**

Write `src/pages/TechTree.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network } from 'lucide-react'
import { fetchSkills, fetchUserSkills, subscribeUserSkills } from '../lib/skillService'
import { useAuth } from '../contexts/AuthContext'

const PATH_COLORS = {
  hub: '#a78bfa',
  daten: '#60a5fa',
  sicherheit: '#f87171',
  tracking: '#a78bfa',
  llm: '#f59e0b',
  automation: '#4ade80',
  cloud: '#06b6d4',
  spielerei: '#ec4899',
}

const PATH_LABELS = {
  hub: 'Hub',
  daten: 'Daten aus dem Netz',
  sicherheit: 'Sicherheit',
  tracking: 'Mich verstehen',
  llm: 'Sprachmodelle',
  automation: 'Automation',
  cloud: 'Eigene Cloud',
  spielerei: 'Werkzeuge',
}

const NODE_W = 130
const NODE_H = 34

export default function TechTree() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [skills, setSkills] = useState([])
  const [unlocked, setUnlocked] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSkills(), user ? fetchUserSkills() : []]).then(([s, u]) => {
      setSkills(s)
      setUnlocked(new Set(u.map(x => x.skill_id)))
      setLoading(false)
    })
    if (!user) return
    const unsub = subscribeUserSkills((row) => {
      setUnlocked(prev => new Set([...prev, row.skill_id]))
    })
    return unsub
  }, [user])

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Tech-Baum…</div>
  }

  const hubSkills = skills.filter(s => s.path === 'hub')
  const paths = ['daten','sicherheit','tracking','llm','automation','cloud','spielerei'].filter(p => skills.some(s => s.path === p))

  function isAvailable(skill) {
    if (unlocked.has(skill.id)) return true
    const reqs = Array.isArray(skill.requires) ? skill.requires : []
    return reqs.every(r => unlocked.has(r))
  }
  function status(skill) {
    if (unlocked.has(skill.id)) return 'done'
    if (isAvailable(skill)) return 'available'
    return 'locked'
  }

  // SVG-Rechnung
  const hubX = 60
  const hubY = 350
  const skillsByPath = Object.fromEntries(paths.map(p => [p, skills.filter(s => s.path === p)]))

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Network className="w-4 h-4" /> Tech-Baum
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Dein Lernpfad</h1>
        <p className="text-gray-400 mt-3 text-sm">
          {unlocked.size} von {skills.length} Fähigkeiten freigeschaltet. Klick einen Knoten an und lerne ihn.
        </p>
      </div>

      <div className="bg-gradient-to-b from-cosmos-900 to-cosmos-800 rounded-2xl border border-white/10 p-4 overflow-x-auto">
        <svg viewBox="0 0 1100 720" className="w-full min-w-[1000px] h-[720px]" style={{ display: 'block' }}>
          {/* Pfad-Bahnen */}
          {paths.map(p => {
            const sk = skillsByPath[p]
            if (sk.length === 0) return null
            const color = PATH_COLORS[p]
            let d = `M ${hubX + NODE_W} ${hubY + NODE_H/2} `
            sk.forEach((s, i) => {
              const tx = s.display_x + NODE_W/2
              const ty = s.display_y + NODE_H/2
              const prev = i === 0 ? { x: hubX + NODE_W, y: hubY + NODE_H/2 } : { x: sk[i-1].display_x + NODE_W/2, y: sk[i-1].display_y + NODE_H/2 }
              const midX = (prev.x + tx) / 2
              d += `C ${midX} ${prev.y} ${midX} ${ty} ${tx} ${ty} `
            })
            return <path key={p} d={d} stroke={color} strokeWidth="3" fill="none" opacity="0.3" />
          })}

          {/* Hub-Knoten */}
          {hubSkills.map((s, i) => (
            <SkillNode
              key={s.id}
              skill={s}
              status={status(s)}
              isHub
              onClick={() => navigate(`/lesson/${s.id}`)}
            />
          ))}
          {/* Pfad-Knoten */}
          {paths.flatMap(p => skillsByPath[p]).map(s => (
            <SkillNode
              key={s.id}
              skill={s}
              status={status(s)}
              onClick={() => navigate(`/lesson/${s.id}`)}
            />
          ))}
        </svg>
      </div>

      {/* Pfad-Legende */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
        {paths.map(p => (
          <div key={p} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
            <div className="w-3 h-3 rounded-full" style={{ background: PATH_COLORS[p] }} />
            <span className="text-gray-300">{PATH_LABELS[p]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillNode({ skill, status, isHub, onClick }) {
  const x = isHub ? 60 : skill.display_x
  const y = isHub ? skill.display_y : skill.display_y
  const fillByStatus = {
    done: 'rgba(74,222,128,0.18)',
    available: 'rgba(255,255,255,0.06)',
    locked: 'rgba(255,255,255,0.03)',
  }
  const strokeByStatus = {
    done: 'rgba(74,222,128,0.55)',
    available: 'rgba(255,255,255,0.22)',
    locked: 'rgba(255,255,255,0.12)',
  }
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: status === 'locked' ? 0.5 : 1 }}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8} ry={8}
        fill={isHub ? 'rgba(167,139,250,0.22)' : fillByStatus[status]}
        stroke={isHub ? 'rgba(167,139,250,0.55)' : strokeByStatus[status]}
        strokeWidth="1"
      />
      <text x={14} y={NODE_H/2 + 6} fontSize="16">{skill.icon}</text>
      <text x={38} y={NODE_H/2 + 5} fontSize="12" fill="#fff" fontWeight={isHub ? 700 : 500}>
        {skill.name.length > 18 ? skill.name.slice(0, 17) + '…' : skill.name}
      </text>
    </g>
  )
}
```

- [ ] **Step 2: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/TechTree.jsx && git commit -m "$(cat <<'EOF'
ui: TechTree-Page mit SVG-Hub-und-Pfade

Lädt skills + user_skills, rendert SVG: Hub links + 7 farbige
Pfad-Bahnen. Status-Färbung (done/available/locked) auf Knoten.
Realtime-Updates über user_skills-Channel. Klick navigiert zur
Lesson-Page.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Lesson-Page (3-Karten-Flow)

**Files:**
- Create: `src/pages/Lesson.jsx`

- [ ] **Step 1: Page schreiben**

Write `src/pages/Lesson.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { fetchSkill, fetchUserSkills, startLesson, advanceLesson, findOpenLesson, markSkillUnlocked, subscribeUserSkills } from '../lib/skillService'
import { TermText } from '../components/MiniWiki'
import { BOT_TEXT } from '../lib/botMessages'
import { useAuth } from '../contexts/AuthContext'

export default function Lesson() {
  const { skillId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [skill, setSkill] = useState(null)
  const [card, setCard] = useState(1)        // 1 = Konzept, 2 = Praxis, 3 = Erfolg
  const [session, setSession] = useState(null)
  const [unlockedSet, setUnlockedSet] = useState(new Set())

  // Initial Load
  useEffect(() => {
    if (!skillId) return
    fetchSkill(skillId).then(setSkill).catch(console.error)
    if (user) {
      fetchUserSkills().then(u => setUnlockedSet(new Set(u.map(x => x.skill_id))))
    }
  }, [skillId, user])

  // Wenn schon freigeschaltet → direkt zu Karte 3
  useEffect(() => {
    if (skill && unlockedSet.has(skill.id)) setCard(3)
  }, [skill, unlockedSet])

  // Realtime: bei user_skills-Insert → Karte 3
  useEffect(() => {
    if (!user || !skill) return
    const unsub = subscribeUserSkills((row) => {
      if (row.skill_id === skill.id) {
        setUnlockedSet(prev => new Set([...prev, row.skill_id]))
        setCard(3)
      }
    })
    return unsub
  }, [user, skill])

  async function startLessonClick() {
    const s = await startLesson(skill.id)
    setSession(s)
    setCard(2)
    // Browser-Skills haben State 'task' aber kein Webhook erwartet → wir verifizieren lokal beim Klick
    if (skill.verification_type === 'browser' || skill.verification_type === 'konzept') {
      // bleibt auf Karte 2 bis User "Verstanden" klickt
    } else {
      // action-Skill: state auf 'task' damit der Webhook es findet
      await advanceLesson(s.id, 'task')
    }
  }

  async function browserComplete() {
    if (!session) return
    await advanceLesson(session.id, 'verified')
    await markSkillUnlocked(skill.id)
    setUnlockedSet(prev => new Set([...prev, skill.id]))
    setCard(3)
  }

  if (!skill) {
    return <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 text-center text-gray-400">Lade Lesson…</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
      <button onClick={() => navigate('/tech-tree')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Zurück zum Tech-Baum
      </button>

      {/* Progress-Punkte */}
      <div className="flex gap-2 mb-6">
        <Dot active={card === 1} done={card > 1} />
        <Dot active={card === 2} done={card > 2} />
        <Dot active={card === 3} done={card > 3} />
      </div>

      {card === 1 && <ConceptCard skill={skill} onNext={startLessonClick} />}
      {card === 2 && <TaskCard skill={skill} onBrowserComplete={browserComplete} />}
      {card === 3 && <SuccessCard skill={skill} onBack={() => navigate('/tech-tree')} />}
    </div>
  )
}

function Dot({ active, done }) {
  return <div className={`flex-1 h-1 rounded-full ${done ? 'bg-green-400' : active ? 'bg-nebula-500' : 'bg-white/10'}`} />
}

function ConceptCard({ skill, onNext }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <div className="text-4xl mb-3">{skill.icon}</div>
      <h2 className="font-display text-2xl font-bold text-white mb-2">{skill.name}</h2>
      <div className="text-xs uppercase tracking-wider text-nebula-400 mb-4">Pfad: {skill.path} · Typ: {skill.skill_type}</div>

      <h3 className="text-xs uppercase text-gray-400 mb-1">Was kannst du damit machen</h3>
      <p className="text-gray-200 mb-5">{skill.description}</p>

      <h3 className="text-xs uppercase text-gray-400 mb-1">Wie es funktioniert</h3>
      <div className="text-gray-300 mb-5 leading-relaxed">
        <TermText html={skill.how_it_works} />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5 text-sm text-amber-200">
        <strong>Token-Verbrauch:</strong> {skill.token_cost_estimate}
      </div>

      <button onClick={onNext} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Verstanden → Üben
      </button>
    </div>
  )
}

function TaskCard({ skill, onBrowserComplete }) {
  // verifikation_type entscheidet Layout
  if (skill.verification_type === 'browser') {
    return <BrowserTaskCard skill={skill} onComplete={onBrowserComplete} />
  }
  if (skill.verification_type === 'konfig') {
    return <ConfigTaskCard skill={skill} />
  }
  return <ActionTaskCard skill={skill} />
}

function ActionTaskCard({ skill }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Probier's selbst</h2>
      <p className="text-gray-200 mb-4">Schreib deinem Telegram-Bot eine passende Nachricht — sobald er den Befehl erkennt, schaltet diese Karte hier automatisch um.</p>

      <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-500 mb-1">Beispiel-Nachrichten:</div>
        <ExampleHint skillId={skill.id} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-nebula-400" />
        {BOT_TEXT.lesson_card2_waiting}
      </div>
    </div>
  )
}

function ExampleHint({ skillId }) {
  const examples = {
    weather: ['/wetter Berlin', 'wie ist das wetter in Hamburg'],
    web_search: ['/suche Quantencomputer', 'finde Vegane Rezepte'],
    wikipedia: ['/wiki Photosynthese', 'was ist Quantenphysik'],
    currency: ['wie viel sind 50 USD in EUR', '/kurs USD EUR'],
    countries: ['/land Frankreich', 'info zu Japan'],
    notes: ['notiz: Milch kaufen', '/notiz Bürotermin morgen'],
    mood: ['stimmung: 4', '/stimmung 3'],
    habits: ['habit: meditiert', 'heute Sport gemacht'],
    reminder: ['in 30 min erinnere mich an Yoga', 'in 2 stunden erinnere mich an den Kuchen'],
    pomodoro: ['/pomodoro'],
    joke_quote: ['/witz', 'witz'],
  }
  const list = examples[skillId] || ['(noch keine Beispiele)']
  return (
    <ul className="space-y-1 text-sm">
      {list.map(e => <li key={e} className="text-amber-200 font-mono">{e}</li>)}
    </ul>
  )
}

function BrowserTaskCard({ skill, onComplete }) {
  // Spezielle Tools werden inline gerendert
  const demo = renderBrowserDemo(skill.id)
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Probier's selbst</h2>
      <p className="text-gray-200 mb-4">{BOT_TEXT.lesson_card2_browser}</p>
      <div className="bg-black/30 border border-white/10 rounded-lg p-4 mb-4">
        {demo}
      </div>
      <button onClick={onComplete} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Hab's verstanden — freischalten
      </button>
    </div>
  )
}

function ConfigTaskCard({ skill }) {
  return (
    <div className="bg-cosmos-900 border border-white/10 rounded-2xl p-6">
      <h2 className="font-display text-xl font-bold text-white mb-3">Setup</h2>
      <p className="text-gray-200 mb-4">{BOT_TEXT.lesson_card2_konfig}</p>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-200">
        Für „{skill.name}" gibt's eine eigene Setup-Seite. Geh auf <strong>/keys</strong> und folge dort der Anleitung.
      </div>
    </div>
  )
}

function SuccessCard({ skill, onBack }) {
  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/40 rounded-2xl p-6">
      <CheckCircle2 className="w-10 h-10 text-green-400 mb-3" />
      <h2 className="font-display text-2xl font-bold text-white mb-2">{BOT_TEXT.lesson_card3_success}</h2>
      <p className="text-gray-300 mb-4">
        „{skill.name}" ist jetzt freigeschaltet. Du kannst die Fähigkeit ab sofort nutzen.
      </p>
      <button onClick={onBack} className="w-full bg-nebula-500 hover:bg-nebula-400 text-white font-medium py-3 rounded-lg">
        Zurück zum Tech-Baum
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Browser-Demos für die nicht-Telegram-Skills
function renderBrowserDemo(skillId) {
  switch (skillId) {
    case 'dice': return <DiceDemo />
    case 'qr_code': return <QrDemo />
    case 'math_practice': return <MathDemo />
    case 'hash_tools': return <HashDemo />
    case 'password_gen': return <PasswordDemo />
    case 'leak_check': return <LeakDemo />
    default: return <div className="text-gray-400 text-sm">Demo noch nicht implementiert.</div>
  }
}

function DiceDemo() {
  const [val, setVal] = useState(null)
  return (
    <div className="text-center">
      <div className="text-6xl my-3">{val ?? '?'}</div>
      <button onClick={() => setVal(Math.ceil(Math.random() * 6))} className="px-4 py-2 bg-nebula-500 text-white rounded">
        Würfeln
      </button>
    </div>
  )
}

function QrDemo() {
  const [text, setText] = useState('https://earth-01.netlify.app')
  // qrserver.com ist kostenlos + ohne Key, gibt direkt ein PNG zurück
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-3" placeholder="Text oder URL für den QR-Code" />
      <div className="text-center bg-white p-3 rounded">
        <img src={src} alt="QR" className="mx-auto" width={200} height={200} />
      </div>
    </div>
  )
}

function MathDemo() {
  const [problem] = useState(() => ({ a: Math.ceil(Math.random()*20), b: Math.ceil(Math.random()*20) }))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  return (
    <div>
      <div className="text-xl text-white mb-3 text-center">{problem.a} + {problem.b} = ?</div>
      <input value={answer} onChange={e => setAnswer(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
      <button onClick={() => setFeedback(parseInt(answer) === problem.a + problem.b ? '✓ Richtig!' : '✗ Falsch')} className="w-full bg-nebula-500 text-white py-2 rounded text-sm">
        Prüfen
      </button>
      {feedback && <div className="text-center text-sm mt-2 text-amber-200">{feedback}</div>}
    </div>
  )
}

function HashDemo() {
  const [text, setText] = useState('Hallo Welt')
  const [hash, setHash] = useState('')
  async function compute() {
    const enc = new TextEncoder().encode(text)
    const buf = await crypto.subtle.digest('SHA-256', enc)
    setHash(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''))
  }
  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
      <button onClick={compute} className="w-full bg-nebula-500 text-white py-2 rounded text-sm mb-3">SHA-256 berechnen</button>
      {hash && <div className="bg-black/40 rounded p-2 font-mono text-[10px] text-amber-200 break-all">{hash}</div>}
    </div>
  )
}

function PasswordDemo() {
  const [pw, setPw] = useState('')
  function gen() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    setPw(Array.from(arr).map(b => chars[b % chars.length]).join(''))
  }
  return (
    <div className="text-center">
      <div className="bg-black/40 p-3 rounded font-mono text-amber-200 mb-3 break-all">{pw || '(klick erzeugen)'}</div>
      <button onClick={gen} className="px-4 py-2 bg-nebula-500 text-white rounded">Sicheres Passwort erzeugen</button>
    </div>
  )
}

function LeakDemo() {
  const [pw, setPw] = useState('')
  const [result, setResult] = useState('')
  async function check() {
    setResult('Prüfe…')
    const enc = new TextEncoder().encode(pw)
    const buf = await crypto.subtle.digest('SHA-1', enc)
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase()
    const prefix = hex.slice(0, 5), suffix = hex.slice(5)
    try {
      const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
      const lines = (await r.text()).split('\n')
      const hit = lines.find(l => l.split(':')[0] === suffix)
      if (hit) setResult(`⚠ Geleakt — ${hit.split(':')[1].trim()} mal gefunden!`)
      else setResult('✓ Bisher unbekannt — gut!')
    } catch { setResult('Prüfung fehlgeschlagen') }
  }
  return (
    <div>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" placeholder="dein Passwort" />
      <button onClick={check} disabled={!pw} className="w-full bg-nebula-500 disabled:opacity-50 text-white py-2 rounded text-sm">
        Prüfen (k-Anonymity)
      </button>
      {result && <div className="text-center text-sm mt-3 text-amber-200">{result}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/Lesson.jsx && git commit -m "$(cat <<'EOF'
ui: Lesson-Page mit 3-Karten-Flow

Konzept (Beschreibung + Termtext mit Glossar) → Praxis
(Action: warten auf Telegram / Browser: inline-Demo) →
Erfolg (Auto-Switch via Realtime auf user_skills).
6 inline Browser-Demos: Würfel, QR, Mathe, Hash, Passwort, Leak.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Keys-Page

**Files:**
- Create: `src/pages/Keys.jsx`

- [ ] **Step 1: Page schreiben**

Write `src/pages/Keys.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Key, Check, X } from 'lucide-react'
import { fetchUserKeys, saveUserKey, testKey } from '../lib/keyService'
import { BOT_TEXT } from '../lib/botMessages'

const FIELDS = [
  { field: 'llm_api_key', label: 'LLM-Key (Groq / NVIDIA / OpenRouter / OpenAI)', placeholder: 'gsk_…  sk-or-…  nvapi-…  sk-…', help: 'Empfohlen: gratis Key auf https://console.groq.com/keys (Prefix gsk_)' },
  { field: 'huggingface_key', label: 'Hugging-Face-Key (Bild-Generation)', placeholder: 'hf_…', help: 'gratis: https://huggingface.co/settings/tokens' },
  { field: 'resend_api_key', label: 'Resend-Key (Email-Versand)', placeholder: 're_…', help: '100 Mails/Tag gratis: https://resend.com' },
]

export default function Keys() {
  const [keys, setKeys] = useState({})
  const [edits, setEdits] = useState({})
  const [results, setResults] = useState({})
  const [saving, setSaving] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserKeys().then(k => { setKeys(k ?? {}); setLoading(false) })
  }, [])

  async function save(field) {
    setSaving(s => ({ ...s, [field]: true }))
    try {
      const val = edits[field]
      await saveUserKey(field, val)
      const r = await testKey(field, val)
      setResults(s => ({ ...s, [field]: r }))
      setKeys(k => ({ ...k, [field]: val }))
      setEdits(e => { const n = { ...e }; delete n[field]; return n })
    } catch (e) {
      setResults(s => ({ ...s, [field]: { ok: false, message: e.message }}))
    } finally {
      setSaving(s => ({ ...s, [field]: false }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Key className="w-4 h-4" /> API-Keys
        </div>
        <h1 className="font-display text-4xl font-bold text-white">Schlüssel verwalten</h1>
        <p className="text-gray-400 mt-3 text-sm">
          Jeder Schlüssel kommt von dir, bleibt bei dir. Wir leiten ihn nur an den jeweiligen Dienst weiter.
        </p>
      </div>

      {loading && <div className="text-gray-400 text-center">Lade…</div>}
      {!loading && FIELDS.map(({ field, label, placeholder, help }) => {
        const current = keys[field] ?? ''
        const masked = current ? `${current.slice(0,4)}…${current.slice(-3)}` : ''
        const editing = edits[field] !== undefined
        const r = results[field]
        return (
          <div key={field} className="bg-cosmos-900 border border-white/10 rounded-2xl p-4 mb-4">
            <label className="text-sm text-gray-300 block mb-2">{label}</label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={editing ? edits[field] : ''}
                onChange={(e) => setEdits(p => ({ ...p, [field]: e.target.value }))}
                placeholder={current ? `gespeichert: ${masked}` : placeholder}
                className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => save(field)}
                disabled={!editing || saving[field]}
                className="px-3 py-2 bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50 text-white text-sm rounded-md"
              >
                {saving[field] ? '…' : 'Speichern & testen'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{help}</div>
            {r && (
              <div className={`mt-1 text-xs flex items-center gap-1 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
                {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {r.message}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/Keys.jsx && git commit -m "$(cat <<'EOF'
ui: Keys-Page für Drittanbieter-Schlüssel

Eingabefelder für LLM/HF/Resend, Auto-Detect am Prefix
(bereits in keyService implementiert), Live-Test des
Schlüssels nach dem Speichern.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: App.jsx + Navigation finalisieren

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Navigation.jsx`

- [ ] **Step 1: App.jsx aktualisieren**

Write `src/App.jsx`:

```jsx
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import TechTree from './pages/TechTree'
import Lesson from './pages/Lesson'
import Keys from './pages/Keys'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AuthProvider>
      {!isHome && <Starfield />}
      <Navigation />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wissen" element={<Knowledge />} />
          <Route path="/tech-tree" element={<TechTree />} />
          <Route path="/lesson/:skillId" element={<Lesson />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Navigation-Links aktualisieren**

Read existing `src/components/Navigation.jsx`. Suche das Array oder den Block der die Links definiert. Stelle sicher dass folgende Links existieren (Reihenfolge passend zur Hauptnutzung):

- `/` Home
- `/wissen` Wissen
- `/tech-tree` Tech-Baum (lucide-Icon: `Network`)
- `/keys` Keys (lucide-Icon: `Key`)
- Login-Button bei nicht-angemeldeten Usern

Falls die Datei ein `links`-Array hat: ersetze mit:
```jsx
import { Home, BookOpen, Network, Key } from 'lucide-react'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/wissen', label: 'Wissen', icon: BookOpen },
  { to: '/tech-tree', label: 'Tech-Baum', icon: Network },
  { to: '/keys', label: 'Keys', icon: Key },
]
```

- [ ] **Step 3: Build prüfen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/App.jsx src/components/Navigation.jsx && git commit -m "$(cat <<'EOF'
ui: Routes + Navigation auf Tech-Tree-MVP

Neue Routes: /tech-tree, /lesson/:skillId, /keys.
Navigation-Links zeigen Home, Wissen, Tech-Baum, Keys.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Deploy + Smoke-Test

**Files:** keine — nur Deploy + manuelle Verifikation.

- [ ] **Step 1: Frontend deployen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx netlify deploy --prod --dir=dist
```

Note Production URL.

- [ ] **Step 2: Manuelle Browser-Verifikation**

Öffne https://earth-01.netlify.app/tech-tree (eingeloggt). Erwarte:
- Header zeigt „0 von 20 Fähigkeiten freigeschaltet"
- SVG mit Hub-Knoten links (api_keys, telegram) und 7 farbigen Pfad-Bahnen rechts
- Knoten haben Icons + gekürzte Namen
- Klick auf einen Knoten → Lesson-Page öffnet

Öffne `/lesson/weather`:
- Karte 1: „Wetter" + Beschreibung + how_it_works mit unterstrichenem `REST-API`
- Klick auf `REST-API` → Tooltip mit Glossar-Eintrag
- Klick „Verstanden → Üben" → Karte 2 mit Beispielen + Loader „Dein Bot wartet"

Öffne `/lesson/dice` (Browser-Skill):
- Karte 1 ähnlich
- Karte 2: inline-Würfel-Demo + „Hab's verstanden — freischalten"-Button
- Klick → Karte 3 (Erfolg)
- Zurück auf `/tech-tree`: Würfel-Knoten ist grün

Öffne `/keys`:
- Drei Felder (LLM / HF / Resend)
- Felder eintragen + speichern testet den Key

- [ ] **Step 3: Telegram-Webhook-Test**

Falls Telegram-Bot verbunden ist (separater Flow):
- Sende „/wetter Berlin" an den Bot
- Vor Lesson-Aktivierung: Antwort „Dein Bot kennt diese Fähigkeit noch nicht. Erlerne erst 'weather'."
- Starte Lesson für Wetter, fortschritt auf Karte 2
- Sende „/wetter Berlin" — sollte: (a) Wetter-Antwort kommen, (b) auf der Lesson-Page automatisch Karte 3 erscheinen

- [ ] **Step 4: Verifikations-Checklist**

Working:
- [ ] /tech-tree zeigt SVG mit 20 Skills in 7 Pfaden
- [ ] Klick auf Knoten öffnet Lesson
- [ ] Glossar-Tooltip funktioniert (mind. 1 Term anklicken)
- [ ] Browser-Skill (Würfel) lässt sich komplett durchspielen
- [ ] Tech-Tree-Status aktualisiert sich nach Unlock
- [ ] /keys speichert und testet
- [ ] Telegram-Bot antwortet bei freigeschaltetem Skill (mind. 1 Skill ausprobieren)

Bei Problemen: Supabase-Functions-Logs prüfen.

- [ ] **Step 5: Branch ggf. mergen**

Wenn alles funktioniert:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git checkout main && git merge --no-ff tech-tree-mvp -m "Merge tech-tree-mvp: Phase 1"
```

---

## Phase 1 — Abschluss

Nach Task 16:
- Alter Sim/Dynastie-Code ist gelöscht
- 20 Skills funktionieren, verteilt auf 7 Pfade
- Lesson-Flow (3 Karten) inkl. Browser-Demos + Telegram-Verifikation
- Mini-Wiki-Tooltips für 28 Glossar-Begriffe
- Keys-Setup mit Auto-Detect
- Tech-Tree-Page als Hauptscreen

**Nächste Schritte (Phase 2):**
- 🤖 LLM-Pfad: LLM-Chat, Recipe, RAG, Translator, Image-Gen, Whisper, Mini-Modell
- Workflow-Engine vorbereiten

**Nächste Schritte (Phase 3):**
- ☁️ Cloud-Pfad: Google Drive OAuth, GitHub Storage, OneDrive, quota_view

**Nächste Schritte (Phase 4):**
- 📰 Tägliches Briefing, Zweites Gehirn (Workflows)
- 📧 Email-Versand
- Erweiterte Tracking-Skills (reading_log, birthdays, maintenance)
