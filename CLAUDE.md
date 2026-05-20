# Earth 0.1 — Projekt-Gedächtnis

## Was ist das?

Eine persistente Welt, in der KI-Agenten leben, arbeiten, kooperieren und evolvieren. 30x30 Hex-Grid-Karte (Civ-Style), Agenten mit Tagesrhythmus (Arbeit/Freizeit/Schlaf), Reproduktion mit Vererbung, Reputationssystem, Gesellschaftsbildung.

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Edge Functions + Realtime)
- **3D:** react-globe.gl + Three.js (via objectsData, NICHT polygonsData)
- **Auth:** Supabase Auth (GitHub, Google, Email)
- **Deploy:** Netlify → earth-01.netlify.app
- **LLM:** Dual-System (Shared Gemini server-seitig + User-eigenes LLM browser-seitig)

## Supabase

- Projekt-ID: `giyvmksetvberzrpvuhu`
- URL: `https://giyvmksetvberzrpvuhu.supabase.co`
- Tabellen: `profiles`, `world_state`, `world_tiles`, `agents`, `agent_memory`, `agent_actions`, `world_events`, `agent_messages`, `agent_reminders`, `world_tech`, `alliances`
- RLS aktiv auf allen Tabellen

## Deploy

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
npx vite build && npx netlify deploy --prod --dir=dist
```

## Dateistruktur

### Pages (`src/pages/`)
| Datei | Route | Beschreibung |
|-------|-------|-------------|
| Home.jsx | / | Landing Page |
| World.jsx | /world | Weltkarte (2D Canvas + 3D Globus) |
| Configurator.jsx | /configurator | Agent erstellen/konfigurieren |
| Dashboard.jsx | /dashboard | Agent-Übersicht + LLM-Config |
| Knowledge.jsx | /knowledge | Wissensdatenbank |
| Login.jsx | /login | Auth-Seite |
| AuthCallback.jsx | /auth/callback | OAuth-Redirect |

### Components (`src/components/`)
| Datei | Beschreibung |
|-------|-------------|
| **WorldCanvas.jsx** | 2D Hex-Grid auf HTML Canvas. Pointy-top Hexagone, Terrain-Noise, Küstenlinien-Glow, Wellen, Agent-Rendering |
| **WorldGlobe.jsx** | 3D Globus mit react-globe.gl. Hex-Tiles als flat THREE.ShapeGeometry via objectsData. Agenten als Points mit altitude |
| AgentConfigurator.jsx | Personality-Slider, Agent-Erstellung in DB |
| Navigation.jsx | Top-Navigation |
| Earth.jsx | Animierte Erde für Landing Page |
| Starfield.jsx | Sternenhintergrund-Animation |
| Footer.jsx | Footer |
| LLMConfig.jsx | LLM-Provider-Konfiguration (NVIDIA/OpenAI/Gemini Cloud-APIs) |
| TechTreePanel.jsx | Technologiebaum-Anzeige (12 Techs in 5 Stufen) |
| TelegramSetup.jsx | Telegram-Bot-Verknüpfung |
| WebChat.jsx | Browser-Chat mit Agent (LLM-basiert) |

### Libraries (`src/lib/`)
| Datei | Beschreibung |
|-------|-------------|
| **hexUtils.js** | Hex-Mathematik: hexToPixel, pixelToHex, hexCorners, hexDistance, canvasSize. Pointy-top, odd-r offset |
| **landMask.js** | 30x30 Land/Ozean-Maske (L/o Strings), isLand(), landBaseColor(), hexNeighbors(), OCEAN_COLOR |
| worldService.js | Supabase-Datenzugriff + Realtime-Subscriptions |
| llmAdapters.js | LLM-Provider-Adapter (OpenAI-kompatibel, Gemini) |
| agentBrain.js | Prompt-Templates fuer Agent-Entscheidungen |
| supabase.js | Supabase-Client-Initialisierung |

### Contexts (`src/contexts/`)
| Datei | Beschreibung |
|-------|-------------|
| AuthContext.jsx | Auth-State + Supabase Auth |
| WorldContext.jsx | World State + Realtime als React Context |

### Edge Functions (`supabase/functions/`)
| Datei | Beschreibung |
|-------|-------------|
| simulation-tick/ | Simulationsengine (pg_cron, jede Minute, intern 10 Ticks). Hex-Nachbarn, Freeciv-Mechaniken (Ressourcen, Rollen, Tech, Kampf, Allianzen) |
| spawn-agent/ | Agent erstellen (max 2 pro User) |
| get-world-snapshot/ | Initialer World State |
| suggest-action/ | Browser-LLM-Vorschlag annehmen |
| register-telegram/ | Telegram-Bot verknuepfen |
| telegram-webhook/ | Telegram-Nachrichten verarbeiten (6 Agent-Tools: web_search, set_reminder, world_status, my_status, nearby_agents, remember) |
| unregister-telegram/ | Telegram-Bot trennen |

## Hex-Grid-System

- **Orientierung:** Pointy-top (Spitze oben, Catan-Style)
- **Koordinaten:** Odd-r Offset (ungerade Reihen nach rechts versetzt)
- **Grid:** 30x30, mapped auf lat 80N-80S, lng 160W-160E
- **Nachbarn:** 6 statt 4 (hexNeighbors in landMask.js und simulation-tick)
- **2D Canvas:** hexUtils.js fuer Pixel-Konvertierung
- **3D Globus:** gridToGeo() in WorldGlobe.jsx fuer lat/lng-Konvertierung

### Wichtig fuer 3D-Globus (WorldGlobe.jsx)

- `polygonsData` von react-globe.gl hat bekannte Artefakte (Issue #87: Seitenflächen, Z-Fighting)
- Loesung: `objectsData` + `THREE.ShapeGeometry` = flache Meshes ohne Seitenflächen
- Globe-Basis: Dunkle 1x1px Canvas-Textur (#0a1e3d), nur Land-Hexe werden gerendert
- Agenten: pointsData mit altitude 0.012 (schweben ueber Hexen)
- Hex-Size auf Globus: 6 (nach User-Feedback von 3.5 erhoeht)

## Tile-Typen

| Zeichen | Typ | Farbe |
|---------|-----|-------|
| e | empty (Land) | Breitengrad-abhaengig (Polar→Tropen) |
| f | food | #4ade80 |
| w | water | #60a5fa |
| d | danger | #f87171 |
| b | building | #a78bfa |
| s | shelter | #fbbf24 |

## Agenten-System

- Tagesrhythmus: 240 Ticks/Tag (80 Arbeit, 80 Freizeit, 80 Schlaf) — FLEXIBEL pro Agent
- 1 Tick = 6 Sekunden real = 6 Minuten Spielzeit
- Flexibler Rhythmus: Per-Agent Phase-Tracking (work_ticks, free_ticks, sleep_ticks pro Zyklus)
- forced_phase: User-Interrupt setzt Agent sofort in Freizeit (via Telegram)
- Energie 0-100, sinkt stetig, Tod bei 0 oder bei max_age
- Reputation -1 bis 1 (sichtbar fuer andere)
- Personality: priority, social_mode, risk_tolerance, curiosity, cooperation
- Reproduktion: 2 Agenten nahe beieinander, Energie > 65, Personality-Crossover + Mutation
- Wissenstransfer: Eltern vererben bis zu 3 Langzeit-Erinnerungen

## Gedaechtnis-System

- **Kurzzeit** (memory_type='short'): Simulationsereignisse (essen, bauen, Katastrophen, soziale Interaktionen). Max 20 pro Agent, aelteste werden geloescht.
- **Langzeit** (memory_type='long'): Konsolidiert aus Kurzzeit waehrend Schlafphase (alle 40 Schlaf-Ticks). Top-Erinnerung wird befoeordert. Max 10 pro Agent.
- **User** (memory_type='user'): Persoenliches ueber den User (Freunde, Verwandte, Aufgaben, Vorlieben). Extrahiert aus Telegram-Gespraechen via [REMEMBER]-Block im LLM-Prompt. Max 30 pro Agent. Hat `category`-Feld (person, task, preference, fact).
- Wissenstransfer bei Geburt: Top 3 Langzeit-Erinnerungen der Eltern werden mit [Vererbt]-Prefix ans Kind kopiert
- Tabelle: `agent_memory` mit Spalten: agent_id, memory_type, content, importance, tick, category

## Telegram-Integration

- Jeder User erstellt eigenen Bot via @BotFather, Token im Profil gespeichert
- Webhook automatisch gesetzt bei Registrierung
- Edge Functions: register-telegram, telegram-webhook, unregister-telegram
- Webhook-URL: `{SUPABASE_URL}/functions/v1/telegram-webhook?secret={webhook_secret}`
- Chat-Antworten via NVIDIA API (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL als Supabase Secrets)
- LLM-Modell: moonshotai/kimi-k2.5 (NVIDIA API, OpenAI-kompatibel)
- Slash-Commands (/status, /world, /memory, /sleep, /work) brauchen kein LLM
- Nachrichten in agent_messages Tabelle (Realtime-faehig)
- User-Nachricht setzt forced_phase='free' auf dem Agent
- Bei 2 Agenten antwortet der mit hoechster Energie
- Frontend: TelegramSetup.jsx im Dashboard, AgentChat.jsx fuer Chat-Verlauf

## Design-Dokumente

- `docs/superpowers/specs/2026-05-18-hex-grid-design.md` — Hex-Grid Design Spec
- `docs/superpowers/plans/2026-05-18-hex-grid.md` — Hex-Grid Implementierungsplan (abgeschlossen)
- `docs/superpowers/specs/2026-05-18-telegram-flex-rhythm-design.md` — Telegram + Flex Rhythm Spec
- `docs/superpowers/plans/2026-05-18-telegram-flex-rhythm.md` — Telegram Implementierungsplan

## Freeciv-Mechaniken (seit Migration 006)

### Multi-Ressourcen-System
- **Energie** (energy): Nahrung/Ueberleben, 0=Tod
- **Material** (materials): Bau-Ressource, gesammelt von Tiles
- **Wissen** (knowledge): Forschungs-Ressource, gesammelt von Tiles

### Terrain-Ertraege (pro Tile-Typ pro Tick)
| Tile | Nahrung | Material | Wissen |
|------|---------|----------|--------|
| food (f) | 1.5 | 0 | 0 |
| empty (e) | 0.3 | 0.2 | 0 |
| water (w) | 0.5 | 0 | 0.1 |
| building (b) | 0 | 0.5 | 0.3 |
| shelter (s) | 0.2 | 0 | 0.2 |
| danger (d) | 0 | 0.8 | 0 |
| farm (F) | 2.0 | 0 | 0 |
| road (r) | 0.1 | 0.1 | 0 |

### Agenten-Rollen (auto-zugewiesen alle 50 Ticks)
| Rolle | Zuweisung | Bonus |
|-------|-----------|-------|
| farmer | priority < 0.4 | Food x1.5 |
| builder | priority < 0.4 & coop > 0.6 | Build-Kosten x0.7 |
| researcher | curiosity > 0.7 | Knowledge x2.0 |
| guard | risk_tolerance > 0.7 | Attack x1.3, Defense x1.2 |
| trader | social_mode > 0.7 | Trade-Bonus x1.5 |
| generalist | default | Keine |

### Technologiebaum (12 Techs, 5 Stufen)
Tabelle: `world_tech` (Singleton). Forscher-Agenten tragen Wissen bei.
- Stufe 1: agriculture, toolmaking, writing
- Stufe 2: irrigation, bronze_working, masonry
- Stufe 3: currency, medicine, iron_working
- Stufe 4: philosophy, engineering
- Stufe 5: democracy

### Kampfsystem
- Probabilistisch: `attackPower = attack * (0.5 + random * 0.5)` vs `defensePower = defense * (0.5 + random * 0.5) * terrainBonus`
- Terrain-Verteidigungsbonus: shelter +50%, building +30%
- Veteran-Status: 30% Chance bei Sieg, +20% auf attack/defense
- Kills werden gezaehlt

### Allianzen
Tabelle: `alliances`. Agenten mit social_mode > 0.7 und rep > 0.2 koennen Allianzen gruenden (alle 40 Ticks geprueft).

### Bau-Kosten (Energie + Material)
| Gebaeude | Energie | Material |
|----------|---------|----------|
| Building (b) | 15 | 10 |
| Shelter (s) | 10 | 8 |
| Farm (F) | 12 | 5 |
| Road (r) | 5 | 3 |

### Per-User LLM-System
- Jeder User speichert eigenen API-Key in `profiles` (llm_api_key, llm_base_url, llm_model)
- Telegram-Webhook und WebChat nutzen den Key des Users
- Default-Provider: NVIDIA NIM (moonshotai/kimi-k2.5, kostenlos)
- Kein shared Server-Key mehr noetig

## Bekannte Einschraenkungen

- Supabase Free Tier: 500MB DB, 500K Edge Function Calls/Monat, 200 concurrent Realtime
- Gemini Free: 1500 Calls/Tag
- pg_cron: max 2 Jobs auf Free Tier
- react-globe.gl polygonsData: NICHT verwenden (Artefakte). Immer objectsData + ShapeGeometry
