# Earth 0.1 — Tech-Tree-Platform Design

> Spec-Datum: 2026-05-20
> Status: Approved (außer User-Review)
> Ersetzt: 2026-05-19-dynasty-redesign-design.md (Dynastie-Konzept verworfen, "weit am Ziel vorbei")

## Vision

Earth 0.1 wird eine **Bildungsplattform für KI- und Agenten-Grundlagen**, in der Lernende spielerisch Schritt für Schritt Fähigkeiten freischalten. Jedes Lern-Modul lehrt ein KI-Konzept (Token, RAG, Quantisierung, OAuth, Cron, ...) und resultiert in einer real nutzbaren Fähigkeit des persönlichen Agenten. Die Plattform ist mobil-first, kostenlos für User, finanziert sich durch Förderprogramme + AdSense + Affiliate-Token-Käufe.

**Kernschmerz heute (Markt):**
- Bestehende Agent-Frameworks (OpenClaw, Hermes, Flowise, n8n) sind komplex und token-hungrig — mit Free-API-Tier kommt man nicht weit.
- KI-Bildung ist überall versprochen, aber praktisch oft nur Theorie ohne erlebbares Ergebnis.
- Ohne PC keine Agent-Welt: vieles davon erfordert lokale Setups die Smartphone-User ausschließen.

**Kernlösung:**
1. **Skript-zentrierte Skills** statt token-hungrig: jede Fähigkeit prüft "geht das ohne LLM?" zuerst.
2. **User bringt eigene Ressourcen** mit: Free-API-Keys + Cloud-Speicher (Google Drive, GitHub, OneDrive). Plattform speichert nur Zeiger.
3. **Lernen durch Tun**: Lesson-Flow ist Lesen + sofort echte Aktion + automatische Verifikation.
4. **Tech-Tree als Hauptscreen**: visuelle Übersicht aller Fähigkeiten, Voraussetzungen sichtbar, Klick → Detail → Lern-Modul.

## Bruch mit Vorherigem

- **Verworfen:** Dynastie, Erbfolge, Klon-Restart, Achievement-Roguelite, 60×60 Hex-Welt, Agenten-Simulation, alle simulation-tick-Mechaniken
- **Behalten:** Auth (Supabase), Telegram-Bot-Setup, einige Tool-Implementierungen (Wetter, Web-Suche), Edge-Function-Patterns, Landing-Page (`Home.jsx`)
- **Begründung:** Die Simulation war Selbstzweck — das Bildungsziel (verstehen, wie ein Agent funktioniert) hat sie nie erreicht. Stattdessen ein klares Lern-Spiel mit echtem Werkzeug-Output.

## Begriffsklärung

- **Tech-Tree** — horizontaler Verzeichnisbaum aus Skill-Knoten mit Voraussetzungs-Linien. Startpunkt ist „Mein Agent" links, neue Fähigkeiten wachsen nach rechts.
- **Skill** — eine erlernbare Fähigkeit des Agenten. Vier Typen:
  - **Skript-Skill** — deterministischer Code, kein LLM nötig (z.B. Wetter, Math-Eval). Kann ggf. browser-direkt laufen wenn CORS erlaubt.
  - **LLM-Skill** — nutzt User's eigenes Sprachmodell für eine eng definierte Aufgabe (z.B. Rezept-Berater)
  - **Workflow-Skill** — orchestriert mehrere kleinere Skills, oft per Cron (z.B. Tägliches Briefing)
  - **Konfig-Skill** — kein Funktionsskill, sondern Setup-Schritt (Key eintragen, OAuth durchlaufen). Verifikation = Verbindung steht.
- **Lesson-Flow** — der 3-Karten-Pfad vom Klick „Skill erlernen" bis zur Freischaltung
- **Mini-Wiki / Glossar** — Tooltip-Popup beim Klick auf einen Lehrbegriff (`Token`, `RAG`, `Cron`, ...)
- **Bot ist Subjekt** — sprachlicher Stil: nicht "die Plattform überwacht", sondern "dein Bot wartet auf dich". Leicht verspielt.
- **Verifikation** — automatische Prüfung ob ein Skill wirklich gelernt wurde (drei Typen: Action / Konzept / Konfig)

## Zielgruppe

Bewusst breit/pluralistisch:
- **Schüler (10-18)** — kurze Lern-Module, klare Erfolgserlebnisse
- **Erwachsene KI-Neugierige** — verstehen wofür Token, Embeddings, Kontext-Fenster wichtig sind
- **Auszubildende/Studierende** — tieferes Curriculum, Workflow-Komposition

Schwierigkeit ist in 3 Tiers gestaffelt — jeder findet seinen Einstieg.

## Tech-Stack-Constraint

Nichts darf kosten, nichts darf clientseitig zu schwer werden:
- **GitHub** — Code, später öffentliches Repo für Community-Contributions
- **Netlify** — Frontend-Hosting (100 GB Bandbreite/Monat free)
- **Supabase** — Auth, Datenbank für Pointer-Daten, Edge Functions für serverseitige Skills (500K Calls/Monat free)
- **User-Endgerät** — Browser (Smartphone reicht), Telegram-App
- **User-Account-Anbindungen** — Telegram-Bot, Free-API-Keys (Groq/NVIDIA/HF/Resend), optional Cloud-Speicher (Google Drive / GitHub / OneDrive)

Keine zusätzliche Infrastruktur, keine neue npm-Dependency wenn vermeidbar.

---

## Subsysteme

### Subsystem 1 — Tech-Tree (das Herz)

**Visuelles Design:**
- SVG-basiert, horizontaler Fluss (links → rechts)
- Knoten: abgerundete Rechtecke mit Icon + Name
- Verbindungslinien: Bezier-Kurven zwischen Knoten-Mitten, Farbe nach Ziel-Tier
- Status-Farben:
  - **Grün** — abgeschlossen / aktiv
  - **Blau** — gerade in Bearbeitung (Lesson läuft)
  - **Standard** — verfügbar (alle Voraussetzungen erfüllt)
  - **Grau/Locked** — gesperrt (Voraussetzung fehlt oder Key fehlt)
- Hover/Tap zeigt einen feinen Glow

**Interaktion:**
- Klick auf Knoten → Detail-Modal mit:
  - Name + Tier + Skill-Typ
  - Beschreibung (User-Sicht, kein Backend-Sprech)
  - „Wie es funktioniert" (technisch, mit Glossar-Wörtern)
  - **Token-Verbrauch** (grün = 0, orange = LLM-relevant, mit konkreter Zahl)
  - Zwei Buttons: „← Zurück" + „Skill erlernen →" (oder „Voraussetzungen freischalten" wenn gesperrt)
- Mobile: Tree horizontal scrollbar, Detail-Modal als Full-Screen

**Skill-Inhalte v1** (geseedet, nicht im Code hartkodiert — Inhalts-Tabelle in DB):

| Tier | Skill-ID | Icon | Name | Typ | Voraussetzung | Token-Kosten |
|---|---|---|---|---|---|---|
| 1 | api_keys | 🔑 | API-Keys verwalten | config | — | 0 |
| 1 | telegram | 🤖 | Telegram-Bot verbinden | config | — | 0 |
| 1 | weather | 🌤️ | Wetter | script | — | 0 |
| 1 | web_search | 🔍 | Web-Suche | script | — | 0 |
| 1 | reminder | ⏰ | Erinnerungen | script | telegram | 0 |
| 1 | notes | 📝 | Notizen & Listen | script | — | 0 |
| 2 | llm_chat | 💬 | LLM-Chat | llm | api_keys | 200-800 |
| 2 | rag | 📚 | Eigenes Gedächtnis (RAG) | llm | notes, llm_chat | +50-200 |
| 2 | recipe | 🍳 | Rezept-Berater | llm | llm_chat | 300-500 |
| 2 | gdrive | 📂 | Google Drive anbinden | config | api_keys | 0 |
| 2 | github_storage | 🐙 | GitHub-Repo als Gedächtnis | config | — | 0 |
| 2 | image_gen | 🎨 | Bild-Generation | script | api_keys | 0 + Bilder-Quota |
| 2 | whisper | 🗣️ | Sprache → Text | script | api_keys | 0 + STT-Quota |
| 3 | briefing | 📰 | Tägliches Briefing | workflow | weather, reminder, llm_chat | 800-1500 |
| 3 | second_brain | 🧠 | Zweites Gehirn | workflow | rag, notes | 100/Eintrag |
| 3 | quantized_local | ⚡ | Lokales Mini-Modell | script | api_keys | 0 (Server) |
| 3 | email_send | 📧 | Email-Versand | script | api_keys | 0 |
| 3 | translator | 🌐 | Übersetzer | llm | llm_chat | 50-200 |

**MVP** beschränkt sich auf Tier 1 komplett + 2-3 Tier-2-Skills. Tier 3 später.

### Subsystem 2 — Lesson-Flow (3 Karten)

Jede Skill-Aktivierung läuft über drei Karten in serieller Reihenfolge.

**Karte 1 — Konzept (2 Min lesen)**
- Ein zentraler Lehrbegriff (z.B. „Was ist eine REST-API?")
- 2-3 Absätze einfache Sprache mit ein paar `Glossar-Wörtern` unterstrichen
- Mini-Diagramm wenn sinnvoll (ASCII oder einfaches SVG)
- Button „Verstanden →"

**Karte 2 — Praxis-Aufgabe (sofort tun)**
- Klare Anweisung: was der User jetzt tun soll, mit Beispiel-Befehl in `code`-Block
- Live-Status-Anzeige mit pulsierendem Punkt: *„Dein Bot wartet. Schreib ihm."* (für Telegram-Skills) oder *„Dein Bot dreht Däumchen — probier's im WebChat."* (für nicht-Telegram-Skills)
- Verifikations-Logik läuft im Hintergrund
- Optional kleines Info-Icon mit Transparenz-Erklärung: *„Es wird nichts mitgelesen. Das System erkennt nur das Format der Nachricht (z.B. `/wetter`), nicht den Inhalt."*

**Karte 3 — Freischaltung**
- Success-Banner: *„Geschafft! 🎉 Erkannt: Du hast `/wetter Hamburg` geschickt."*
- Was kann der User jetzt: 1-2 Sätze
- Was ist als Folge näher gerückt: Hinweis auf den nächsten Skill der freigeschaltet wurde / freigeschalt werden könnte
- Buttons: „Zum Tech-Tree" + „Nächster Skill →"

**Verifikations-Typen:**

| Typ | Wann | Wie geprüft |
|---|---|---|
| **Action** | User soll eine konkrete Aktion durchführen (Wetter abfragen, Notiz hinzufügen) | Telegram-Webhook oder WebChat-Endpoint erkennt das passende Pattern und meldet Erfolg an die Lesson-Session |
| **Konzept** | Reines Wissens-Modul ohne Aktion (z.B. „Quantisierung verstehen") | 2-3 Multiple-Choice-Fragen nach der Konzept-Karte. Bei korrekt → unlock. Bei falsch → Erklärung wiederholen mit Hint. |
| **Konfig** | User soll einen Key oder Token eintragen (API-Keys, OAuth, Telegram-Token) | Plattform pingt den Dienst kurz mit dem eingegebenen Wert. Bei Antwort 200 → unlock. |

### Subsystem 3 — Mini-Wiki / Glossar (Tooltip-A)

**Wann erscheint es:** Klick auf einen `gepunktet-unterstrichenen` Lehrbegriff irgendwo in der App.

**Anzeige (Tooltip-Variante A):**
- Kleine Box am Klick-Ort (max 260px breit)
- Inhalt:
  - Icon + Begriff + Tier-Badge
  - 2-3 Sätze Erklärung (einfache Sprache)
  - 1 Beispiel in monospace (z.B. „200 Tokens ≈ 150 Wörter")
  - 2-3 verwandte Begriffe als kleine Links
- Schließt bei Klick außerhalb
- Mobile: Box am unteren Rand andocken statt absolute Position

**Inhaltspflege:** Glossar-Tabelle in DB. Auto-Discovery: jedes `<span class="term">…</span>` im Text wird zur Klick-Quelle, der Text-Inhalt ist der Lookup-Key. Wenn der Begriff in der Glossar-Tabelle fehlt, kein Tooltip (graceful degradation).

**MVP-Glossar** (etwa 25 Begriffe):
API, REST-API, JSON, Token, Kontext-Fenster, Prompt, Prompt-Engineering, Embedding, RAG, Cron, OAuth, Webhook, Sprachmodell / LLM, Quantisierung, Inferenz, Whisper / Speech-to-Text, Stable Diffusion, Hugging Face, Endpoint, Tier (Free-Tier), Rate-Limit, Service-Account, WebGPU, REST vs WebSocket, JSON-Schema.

### Subsystem 4 — Skill-Engine (serverseitig)

Verarbeitet die Skill-Ausführung im Hintergrund. Drei Komponenten:

**A — Skill-Registry**
- TypeScript-Modul `_shared/skillRegistry.ts`
- Statische Definition aller Skills mit: ID, Voraussetzungen, Skill-Typ, Handler-Funktion-Name, Token-Kostenschätzung
- Wird zur Compile-Zeit gegen die DB-Skills-Tabelle abgeglichen (für UI-Texte)

**B — Skill-Executor**
- Pro Tool eine Handler-Funktion in `_shared/skillHandlers/<id>.ts`
- Signatur: `async function execute(params, ctx): Promise<SkillResult>`
- `ctx` enthält: user-id, user-keys, user-storage-tokens, supabase-client
- Browser-Direct-Skills (Wetter, Math, Web-Suche zu DuckDuckGo): werden zusätzlich im Frontend implementiert, damit kein Edge-Function-Call nötig wenn die User-Quota gespart werden soll

**C — Verifikations-Worker**
- Edge Function `lesson-verify` — wird von Telegram-Webhook und WebChat aufgerufen
- Schaut: gibt es eine offene Lesson-Session für diesen User?
- Wenn ja: passt die eingehende Nachricht zum erwarteten Pattern?
- Falls ja: Lesson-Session auf „erfolgreich" setzen, Skill als „unlocked" markieren, Notification an Frontend per Realtime

### Subsystem 5 — Storage-Adapter (User-eigener Speicher)

**Plattform-Ebene (Supabase):**
- Pro User: ~5 KB Pointer-Daten (Profil, Settings, Lesson-Fortschritt, Skill-Unlocks)
- Pro User: bis 50 KB Notizen-Cache für Skills die noch ohne externen Speicher nutzbar sein sollen (z.B. erste Einkaufsliste während Onboarding)

**User-Ebene (eigener Cloud-Speicher):**
- Skill „Google Drive anbinden" — OAuth-Flow, Refresh-Token gespeichert
- Skill „GitHub-Repo als Gedächtnis" — Personal Access Token, Repo-Name
- Skill „OneDrive anbinden" — OAuth-Flow (Variante für später)

**Storage-API innerhalb der Plattform:**
- `saveUserData(user_id, namespace, key, value)` — schreibt automatisch in den verbundenen Speicher des Users; Fallback: Supabase-Cache
- `loadUserData(user_id, namespace, key)` — liest analog
- Jeder Storage-Adapter implementiert das gleiche Interface; UI bleibt gleich egal wo der User physisch speichert
- Verschlüsselung: optional, später als Tier-3-Skill „End-to-End-Crypto"

### Subsystem 6 — Datenschutz & Transparenz

- Keine Daten verlassen die Plattform außer zu den vom User explizit verbundenen Diensten
- Jeder Skill zeigt im Detail-Modal an WELCHE externen Dienste angerufen werden
- Lesson-Verifikation prüft NUR das Befehlsmuster (`/wetter\s+\w+`), nicht den Inhalt
- Speicher-Anbindungen sind opt-in, der User kann jederzeit den Token widerrufen
- Bot-Token + API-Keys liegen nur in der eigenen Supabase-Profil-Zeile, nie in Logs

### Subsystem 7 — Monetarisierung (vorbereitet, nicht aktiv im MVP)

Code-Stellen die später aktiviert werden:
- **AdSense-Slot** auf Lern-Detailseiten (nicht im Chat-Fluss)
- **Affiliate-Banner** im Skill-Detail wenn Tokens benötigt: „Dir gehen die Groq-Tokens aus? Hol dir 5 € Credits über diesen Link — wir bekommen 5 % davon."
- **Förder-Footer** auf Landing: „Gefördert durch … (Platzhalter, später setzen)"
- **Premium-Tier-Hooks** in Skill-Executor: hat der User Premium → bessere Rate-Limits

Alles als Stub vorbereiten, Aktivierung später.

---

## Datenmodell (Supabase)

```sql
-- Erweiterung profiles (vorhanden)
ALTER TABLE profiles ADD COLUMN llm_api_key TEXT;          -- bereits da
ALTER TABLE profiles ADD COLUMN groq_api_key TEXT;          -- bereits da
ALTER TABLE profiles ADD COLUMN huggingface_key TEXT;       -- bereits da
ALTER TABLE profiles ADD COLUMN resend_api_key TEXT;        -- bereits da
ALTER TABLE profiles ADD COLUMN telegram_bot_token TEXT;    -- bereits da
ALTER TABLE profiles ADD COLUMN telegram_chat_id TEXT;      -- bereits da
ALTER TABLE profiles ADD COLUMN gdrive_refresh_token TEXT;  -- NEU
ALTER TABLE profiles ADD COLUMN gdrive_folder_id TEXT;      -- NEU
ALTER TABLE profiles ADD COLUMN github_pat TEXT;            -- NEU
ALTER TABLE profiles ADD COLUMN github_repo TEXT;           -- NEU
ALTER TABLE profiles ADD COLUMN preferred_storage TEXT;     -- 'platform' | 'gdrive' | 'github' | 'onedrive'

-- Skill-Katalog (geseedet)
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  skill_type TEXT NOT NULL CHECK (skill_type IN ('script','llm','workflow','config')),
  description TEXT NOT NULL,
  how_it_works TEXT NOT NULL,        -- mit eingebetteten <span class="term">…</span>
  token_cost_estimate TEXT NOT NULL, -- z.B. "0" oder "200-800 pro Nachricht"
  requires JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array von skill_ids
  required_keys JSONB NOT NULL DEFAULT '[]'::jsonb, -- z.B. ["llm_api_key"]
  display_x INT NOT NULL,
  display_y INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Glossar
CREATE TABLE glossary (
  key TEXT PRIMARY KEY,              -- Lookup-Key, z.B. "Token", "RAG", "OAuth"
  icon TEXT,
  category TEXT NOT NULL,            -- "ki-basics", "infrastruktur", "speicher", ...
  short_desc TEXT NOT NULL,          -- 2-3 Sätze
  example TEXT,                      -- 1 Zeile Beispiel
  related JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array verwandter Keys
  more_skill_id TEXT REFERENCES skills(id)    -- Vertiefung in welchem Skill
);

-- User-Lesson-Sessions (offene und abgeschlossene)
CREATE TABLE lesson_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  state TEXT NOT NULL CHECK (state IN ('concept','task','verified','abandoned')),
  expected_pattern TEXT,             -- Regex für die Action-Verifikation
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- User-Skill-Unlocks (welche Skills sind aktiv)
CREATE TABLE user_skills (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

-- Skill-Nutzungs-Log (für Rate-Limits + später Monetarisierung)
CREATE TABLE skill_usage_log (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 1,
  tokens_consumed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, skill_id, date)
);
```

RLS überall: User liest/schreibt nur eigene Daten. Skills + Glossar sind öffentlich lesbar.

---

## Routen / UI-Struktur

| Route | Was | Login nötig? |
|---|---|---|
| `/` | Landing (Home.jsx, bleibt erhalten — gefällt dem User) | nein |
| `/login` | Auth via GitHub / Google / Email | nein |
| `/auth/callback` | OAuth-Redirect | nein |
| `/tech-tree` | **Neuer Hauptscreen** — Tech-Tree mit Skill-Knoten | ja |
| `/lesson/<skill_id>` | Lesson-Flow (3 Karten) | ja |
| `/keys` | Key-Setup (API-Keys, OAuth-Anbindungen) | ja |
| `/glossary` | Statisches Komplett-Glossar (für SEO + tiefes Nachlesen) | nein |
| `/wissen` | bleibt (statische Lerntexte) | nein |

`/welt`, `/chronik`, `/dashboard`, `/konfigurator` — **gestrichen**.

---

## Bot-Subjekt-Sprachprinzip

Jede Wartemeldung formuliert mit Bot als Subjekt + leicht verspielt:

- ✅ „Dein Bot wartet. Schreib ihm."
- ✅ „Dein Bot dreht Däumchen — probier's im Chat!"
- ✅ „Dein Bot träumt vom Wetter in Hamburg…"
- ✅ „Dein Bot hat 4 Werkzeuge gelernt, will mehr."
- ❌ „Wir hören mit"
- ❌ „Die Plattform überwacht deine Aktivität"
- ❌ „Bitte warten Sie auf die Antwort der API"

Im Code: zentrale `botMessages.js` oder eine `i18n`-ähnliche Konstanten-Datei, damit Sprache konsistent bleibt.

---

## Lösch-Plan (was raus muss)

**Komplett löschen:**
- `src/components/WorldCanvas.jsx`, `WorldGlobe.jsx`, `AgentConfigurator.jsx`, `AgentDetailPanel.jsx`, `AgentChat.jsx`, `Leaderboard.jsx`, `QuestPanel.jsx`, `TechTreePanel.jsx` (alt), `WorldEventFeed.jsx`, `WorldStats.jsx`, `DynastyCreator.jsx`, `CharacterHUD.jsx`, `FamilyTicker.jsx`, `DeathModal.jsx`, `AchievementGrid.jsx`, `WebChat.jsx`, `TelegramSetup.jsx` (wird neu im KeySetup vereinheitlicht)
- `src/components/chronik/*` (FamilyTreePanel, ChronicleListPanel, ToolsPanel, KeySetupPanel — neu schreiben)
- `src/pages/World.jsx`, `Configurator.jsx`, `Dashboard.jsx`, `Chronik.jsx`
- `src/lib/landMask.js`, `hexUtils.js`, `familyUtils.js`, `agentBrain.js`, `questDefinitions.js`, `llmAdapters.js` (LLM-Calls laufen jetzt serverseitig pro Skill)
- `src/contexts/WorldContext.jsx`
- `supabase/functions/simulation-tick`, `spawn-agent`, `get-world-snapshot`, `suggest-action`, `webchat-respond`, `reminder-tick` (wird neu), `reflection-weekly`
- `supabase/migrations/006_freeciv_upgrade.sql`, `007_quest_progression.sql`, `008_wildlife_hunting.sql`, `009_dynasty_redesign.sql`, `010_achievement_catalog.sql`, `011_phase_c_tools.sql` — alle DB-Reset

**Behalten:**
- `src/pages/Home.jsx`, `Login.jsx`, `AuthCallback.jsx`, `Knowledge.jsx`
- `src/components/Earth.jsx`, `Starfield.jsx`, `Footer.jsx`, `Navigation.jsx` (anpassen — Links auf neue Routen)
- `src/lib/supabase.js`, `worldService.js` (wird zu `apiService.js` umbenannt + abgespeckt)
- `src/contexts/AuthContext.jsx`
- `supabase/functions/register-telegram`, `telegram-webhook` (wird massiv umgeschrieben — kein Tool-Dispatch mehr, sondern Lesson-Verifikation + Skill-Routing)
- `supabase/functions/unregister-telegram`
- `supabase/migrations/001_initial_schema.sql` durch ein neues konsolidiertes `migrations/100_platform_base.sql` ersetzen (clean start)
- Tailwind-Theme, Vite-Konfig

---

## Implementierungs-Phasen

**Phase 1 — Fundament (MVP)**
- DB-Schema neu (Migration `100_platform_base.sql`)
- Skill-Katalog seeden mit Tier 1 (6 Skills)
- Glossar seeden mit ~25 Begriffen
- Route `/tech-tree` mit Tech-Tree-Komponente (SVG-Rendering)
- Lesson-Flow-Page `/lesson/:skillId` mit 3 Karten
- Mini-Wiki-Tooltip-Komponente
- Skill-Engine-Skelett: 2-3 Skript-Skills funktionstüchtig (Wetter, Web-Suche, Notizen)
- Key-Setup-Seite `/keys`
- Telegram-Webhook angepasst für Lesson-Verifikation
- Lösch-Aktion aller Altlasten

**Phase 2 — LLM-Schicht**
- LLM-Chat-Skill
- RAG-Skill
- Rezept-Berater
- Übersetzer

**Phase 3 — Cloud-Speicher-Anbindungen**
- Google Drive OAuth + Storage-Adapter
- GitHub-Repo-Storage-Adapter
- OneDrive folgt später

**Phase 4 — Workflows**
- Tägliches Briefing
- Zweites Gehirn
- Mini-Modell-im-Browser (Phi-3 via WebLLM)

Jede Phase ist eigener Plan + Implementierungs-Zyklus.

---

## Erfolgsmetriken

1. **Einstieg:** Neuer User schafft den Wetter-Skill in unter 5 Minuten (Lesen + Telegram-Befehl + Freischaltung).
2. **Lehre:** Mind. 60 % der Lesson-Sessions endet mit Verifikation (vs. abgebrochen).
3. **Werkzeug:** Mind. 1 freigeschalteter Skill wird in der Woche nach Unlock erneut benutzt.
4. **Skalierung:** Bei 1.000 angemeldeten Usern bleibt Edge-Function-Quota unter 50 %.

---

## Risiken & offene Punkte

- **OAuth-Setup für Google Drive** braucht einen App-Eintrag in Google Cloud Console — eine Stunde Setup-Aufwand für Projekt-Owner, einmalig.
- **Telegram-Webhook-Listening** für Lesson-Verifikation: parallel zur normalen Bot-Funktion. Pattern-Matching darf nicht zu eng sein, sonst klappt User-Aktion und wird trotzdem nicht erkannt.
- **Browser-direkte API-Calls** (DuckDuckGo, Open-Meteo) — CORS muss bei jedem Provider geprüft sein. Wenn Provider keine CORS-Header sendet, fällt der Call auf Server-Side zurück.
- **Mini-Modell-Skill** ist anspruchsvoll: WebGPU-Support uneinheitlich auf Smartphones. Phase 4, nicht MVP.
- **Inhaltspflege Skills + Glossar** muss leicht sein. Spec: JSON-Seed-Migrationen, später optional ein Admin-UI.

---

## Was diese Spec NICHT umfasst

- Konkrete OAuth-Strings & API-Keys für die Plattform-Konfiguration (sind Geheim, gehört nicht in Repo)
- Detail-Inhalte aller 25 Glossar-Einträge (wird im Implementierungs-Plan als Seed-Daten festgelegt)
- Exakte Werbungsplatzierung / Affiliate-Partner (kommt später, wenn aktiviert wird)
- Internationalisierung — MVP nur Deutsch, EN-Übersetzung als späteres optionales Modul
- Mobile-Apps (alles Web)
