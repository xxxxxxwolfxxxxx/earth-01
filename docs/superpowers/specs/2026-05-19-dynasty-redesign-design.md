# Earth 0.1 — Dynastie-Redesign

> Spec-Datum: 2026-05-19
> Status: Approved, ready for implementation planning

## Vision

Earth 0.1 wird ein **Roguelite-Tamagotchi**, in dem der Spieler eine Familienlinie über Generationen durch eine simulierte Welt führt. Jeder Generationswechsel bringt dem persönlichen KI-Begleiter neue Real-World-Fähigkeiten — der Sim-Agent wird zum Werkzeug im Alltag des Users.

**Kernschmerz heute:** Agent stirbt zufällig, User weiß nicht warum, kein Bezug zur einzelnen Generation.

**Kernlösung:**
1. Tod ist sichtbar und narrativ ("👑 Gisela ist gestorben (Alter). Tochter übernimmt.")
2. Erfolg überlebt den Tod (Achievements bleiben in der Familie)
3. Spielprogression hat reale Auswirkungen (Achievements schalten Tools für den Alltag frei)

## Begriffsklärung

- **Dynastie** — eine Familienlinie, identifiziert durch den User-gewählten Namen (z.B. "Gisela"). Lebt über Generationen.
- **Träger / Hauptcharakter** — der aktuelle Sim-Agent, der die Dynastie-Identität trägt. Mit ihm chattet der User per Telegram/WebChat.
- **Erbe** — ein lebender Nachfahre des Trägers, der bei dessen Tod die Identität übernimmt.
- **Achievement** — eine in der Simulation erspielte Auszeichnung, die ein **Tool** im Alltag des Users freischaltet. Bleibt bei der Dynastie, nicht beim einzelnen Agent.
- **Tool** — eine konkrete Real-World-Fähigkeit (Web-Suche, Erinnerungen, Sprachnachrichten, ...) als Supabase Edge Function umgesetzt.
- **Eingebaut vs Erweitert** — Tool-Klassen. Eingebaut funktioniert ohne extra Setup. Erweitert braucht einen kostenlosen Drittanbieter-Key (Groq, Resend, etc.).
- **Kinderlos-Tod** — Tod ohne lebenden Nachfahren. Strafe: das jüngste Achievement wird gestrichen, ein Klon-Agent startet neu.

## Architektur

Drei lose gekoppelte Subsysteme, sequenziell zu bauen:

```
┌──────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
│  1. Dynastie-Kern    │ → │  2. UI-Overhaul     │ → │  3. Tool-Universum  │
│  (Mechanik + DB)     │   │  (Look & Feel)      │   │  (Telegram-Tools)   │
└──────────────────────┘   └─────────────────────┘   └──────────────────────┘
```

**Infrastruktur-Constraints:** GitHub + Netlify + Supabase + User-Endgerät. Kein neuer Server, keine bezahlten Services, alles auf Free Tiers. Edge Functions laufen auf Supabase Deno-Runtime.

**Bestehende Bausteine bleiben:** 60×60 Hex-Grid, Simulation-Tick alle 6 Sek, Telegram-Webhook pro User, Realtime-Subscriptions. Wird erweitert, nicht ersetzt.

## Subsystem 1 — Dynastie-Kern

### DB-Erweiterungen

```sql
-- Erweiterung von profiles
ALTER TABLE profiles ADD COLUMN main_agent_id UUID REFERENCES agents(id);
ALTER TABLE profiles ADD COLUMN dynasty_name TEXT;
ALTER TABLE profiles ADD COLUMN dynasty_emoji TEXT;
ALTER TABLE profiles ADD COLUMN dynasty_generation INT DEFAULT 1;
ALTER TABLE profiles ADD COLUMN dynasty_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN groq_api_key TEXT;
ALTER TABLE profiles ADD COLUMN resend_api_key TEXT;
ALTER TABLE profiles ADD COLUMN huggingface_key TEXT;

-- Achievement-Katalog (statisch, geseedet via Migration)
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 4),
  description TEXT NOT NULL,
  unlock_condition JSONB NOT NULL,
  tool_id TEXT NOT NULL,
  key_class TEXT NOT NULL CHECK (key_class IN ('builtin', 'extended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pro User freigeschaltete Achievements
CREATE TABLE dynasty_achievements (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_by_agent_id UUID REFERENCES agents(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Agent-Erweiterungen
ALTER TABLE agents ADD COLUMN gender TEXT CHECK (gender IN ('m', 'f'));
ALTER TABLE agents ADD COLUMN eat_count INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN drink_count INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN tiles_visited JSONB DEFAULT '[]';
ALTER TABLE agents ADD COLUMN trades_completed INT DEFAULT 0;
-- agents.kills existiert bereits aus Migration 006 — wird wiederverwendet
```

### Lebenszyklus des Hauptcharakters

**Bei Spielbeginn / Dynasty-Gründung:**
1. User wählt im Configurator Dynasty-Name + Emoji (z.B. "Gisela" + "🧙‍♀️")
2. Erster Agent wird gespawnt mit Gen 0, `agents.id` → `profiles.main_agent_id`
3. `profiles.dynasty_generation = 1`

**Während des Lebens:**
- Bei jedem Tick wird Achievement-Engine aufgerufen, prüft Bedingungen für alle nicht-freigeschalteten Achievements für diesen User.
- Wenn Bedingung erfüllt: INSERT in `dynasty_achievements` + Telegram-Notification + Event in `world_events`.
- Erweiterung der `simulation-tick`-Function um diesen Check (nach Aktionsausführung).

**Bei Tod des Hauptcharakters:**

```
[Tod erkannt: energy ≤ 0 ODER age ≥ max_age]
       │
       ▼
[Erbsuche: findHeir(deadAgent)]
       │
       ├── gefunden ──→ heir.is_main_for_user = user.id
       │                profile.main_agent_id = heir.id
       │                profile.dynasty_generation += 1
       │                world_events INSERT: dynasty_succession
       │                Telegram: "👑 {dynasty_name} ist gestorben ({cause}). {heir.name} (Gen {n}) übernimmt."
       │
       └── kein Erbe ──→ spawnClone(deadAgent)
                         strip oldest achievement (nach unlocked_at)
                         Telegram: "💔 Familie ausgestorben. Klon-Nachfolger versucht erneut. Verloren: {achievement}."
```

**Erbsuche-Algorithmus** (`findHeir`):
```
1. lebende Kinder (parent_a_id = dead OR parent_b_id = dead)
   → wenn vorhanden: höchster score
2. sonst lebende Enkel (Kinder von Kindern, rekursiv)
3. sonst lebende Urenkel, Ururenkel, ...
4. sonst: null → Klon-Fall

score(agent) = agent.reputation * 0.5 
             + (agent.energy / 100) * 0.3 
             + (agent.age / agent.max_age) * 0.2
```

**Achievement-Engine** (in `simulation-tick`):

Performance-Hinweis: Engine läuft nur für den **Hauptcharakter** jedes Users (`profile.main_agent_id`), nicht für jeden lebenden Agenten. Das hält die Tick-Performance auch bei vielen Usern stabil.

```
for user in users_with_main_agent:
  unlocked_ids = dynasty_achievements.where(user_id=user.id).select(achievement_id)
  for achievement in achievements where id NOT IN unlocked_ids:
    if check_condition(achievement.unlock_condition, user, user.main_agent):
      INSERT dynasty_achievements
      INSERT world_events (type=achievement_unlocked, ...)
      send_telegram(user, "🏆 {dynasty} hat '{achievement.name}' freigeschaltet — Tool '{tool}' verfügbar!")
```

**Unlock-Conditions** (JSONB-Schema):
```json
{ "type": "tech_researched", "value": "writing" }
{ "type": "action_count", "action": "eat", "min": 50 }
{ "type": "tiles_visited", "min": 30 }
{ "type": "alliance_founded", "min": 1 }
{ "type": "generation_reached", "min": 5 }
{ "type": "achievement_count", "min": 10 }
{ "type": "all_techs_researched" }
{ "type": "building_count", "value": "F", "min": 1 }
```

### Lebensdauer-Skalierung

Statt fester `max_age = 2400 ± random`, neu:

```
base_max_age = 2400
per_achievement_bonus = 800
max_age = base_max_age + dynasty.achievement_count * per_achievement_bonus + random(-200, +200)
```

Beispiele:
- Gen 0, 0 Achievements: ~2400 Ticks (~4h)
- Gen 3, 6 Achievements: ~7200 Ticks (~12h)
- Gen 5, 12 Achievements: ~12000 Ticks (~20h)
- Vollausgebaut (20 Achievements): ~18400 Ticks (~31h)

Berechnung erfolgt bei Spawn jedes Agenten (Gen 0 Klon UND Geburt durch Reproduktion erben den aktuellen Familien-max_age).

### Childless-Klon-Mechanik

Wenn Hauptchar stirbt ohne Nachfahren:
1. Neuer Agent gespawnt mit:
   - Personality = Original ± Mutation (±0.1 pro Slider)
   - Gleicher Spawn-Punkt wie Original (oder nahegelegenes Land-Tile)
   - Generation = 0 (Familie startet neu)
2. Vom `dynasty_achievements` wird **das jüngste** entfernt (höchstes `unlocked_at`).
3. Der Tool, der zu diesem Achievement gehörte, ist nicht mehr verfügbar.
4. User-Notification mit klarer Info: "Du hast 'Künstler:in' verloren — kein Bilder-Tool mehr bis du es neu erspielst."

Edge Case: Wenn 0 Achievements, kein Verlust möglich → normaler Klon-Spawn ohne Strafe.

### Telegram-Identität

Der Telegram-Bot-Name (`bot_first_name`) bleibt **immer** der Dynasty-Name (z.B. "Gisela"), egal welcher Bio-Agent gerade Träger ist. Beim Wechsel:
- Sara wird zu "Gisela 05" (Anzeigename in App und Logs)
- Bot-Avatar bleibt das vom User gesetzte Emoji
- Akkumuliertes Langzeit-Gedächtnis der Linie wird in den LLM-Prompt eingespeist (siehe `buildChatPrompt`)

## Subsystem 2 — UI-Overhaul

### `/welt` — neue Hauptseite (Layout B)

```
┌────────────────────────────────────────────────────────────┐
│ 🧙‍♀️ Gisela 04 · Gen 4  │ ⚡78 │ ⏳1240/2400 │ 👨‍👩‍👧 4 │ 🏆 6/20 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│            [Karte — Hex-Grid wie aktuell, plus:]           │
│            • Hauptchar mit Pulsier-Glow                    │
│            • Familienmitglieder mit goldenem Rand          │
│            • Auto-Pan auf Hauptchar beim Mount             │
│            • Andere Agenten: Rollen-Emoji                  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ 📜 Gisela hat Sara geheiratet · vor 3 Min                  │
└────────────────────────────────────────────────────────────┘
```

**HUD-Komponente** (`src/components/CharacterHUD.jsx` — NEU):
- Avatar (dynasty_emoji)
- Name (`{dynasty_name} {generation:02d}`)
- 4 Stats: Energie, Alter (mit Restzeit-Balken statt absoluter Zahl), Familiengröße, Achievement-Counter
- Klick auf Avatar → öffnet Detail-Modal mit kompletten Stats, Aktions-Historie, Reputation

**Karten-Komponente** (Erweiterung von `WorldCanvas.jsx`):
- Neue Prop: `mainAgentId`, `familyAgentIds: Set<string>`
- Beim Rendern: Hauptchar bekommt zusätzlichen Glow-Outline-Pass (pulsing 1.5s loop)
- Familie: goldener Rand statt User-Default-Farbe
- Bei initialem Mount: Canvas-Pan zentriert auf Hauptchar (statt 0,0)

**Lebenslauf-Ticker** (`src/components/FamilyTicker.jsx` — NEU):
- Live-Subscribe auf `world_events` mit `agent_id IN family_ids` filter
- Letzte 5 Events sichtbar, scrollbar
- Klick → öffnet vollständige Chronik im Dashboard

### Emoji-Avatar-System

Tabelle Rolle × Geschlecht × Lebensphase:

| Rolle | m | f | Kind |
|---|---|---|---|
| farmer | 👨‍🌾 | 👩‍🌾 | 🧒 |
| builder | 👷 | 👷‍♀️ | 🧒 |
| researcher | 🧙‍♂️ | 🧙‍♀️ | 👦 |
| guard | 🛡️ | 🛡️ | 🧒 |
| trader | 🧑‍💼 | 👩‍💼 | 🧒 |
| generalist | 🧑 | 👩 | 🧒 |

**Geschlecht:** wird bei Spawn zufällig zugewiesen (50/50), gespeichert in `agents.gender`.
**Lebensphase:** Agent gilt als "Kind" wenn `age < 200`. Danach Erwachsenen-Emoji.

**Wichtig:** Der Träger der Dynastie-Identität zeigt im Frontend immer das User-gewählte `dynasty_emoji`, NICHT das Rollen-Emoji. Erst bei Erbübergang ändert sich das Emoji des Trägers zum Dynasty-Emoji.

### `/dashboard` — Familien-Chronik

Tabs:

**🌳 Stammbaum:**
- D3-basierter Familienbaum (oder einfacher mit reactflow / react-d3-tree)
- Knoten = Agenten (lebend = farbig, tot = grau)
- Träger-Marker (kleine Krone) am aktuellen Hauptchar und allen früheren Trägern
- Klick auf Knoten → Detail-Drawer mit Lebenslauf, Memories, Stats

**📜 Chronik:**
- Chronologische Liste aller `world_events` der Familie
- Filterung: Geburten, Hochzeiten, Tode, Achievements, Bauwerke
- Pro Generation gruppiert mit Headern

**🏆 Erfolge:**
- 20 Achievement-Karten in Tier-Gruppen
- Freigeschaltet: Vollfarbig + Datum + welcher Agent es erspielt hat
- Gesperrt: Grau + Hinweis "Erforsche Schrift" / "Baue eine Farm"
- Badge: 🟢 Eingebaut / 🟡 Erweitert

**⚙ Tools:**
- Pro freigeschaltetem Tool: Karte mit Name, Beispiel-Befehl im Telegram, "Probieren"-Button
- Bei Erweitert-Tools ohne Key: "Setup"-Button → öffnet Anleitung im Modal
- Settings-Sektion: Key-Eingabefelder (groq, resend, huggingface)

### Tod-Moment-Sequenz

Wenn `agent.alive` per Realtime auf `false` wechselt UND `agent.id === user.main_agent_id`:

**Stufe 1 (Karte, 2 Sek):**
- Hauptchar fadet aus, Lichtpartikel-Animation nach oben
- Karten-Overlay verdunkelt sich
- Sound (optional, default off): kurzes Glockenklang

**Stufe 2 (Modal):**

Mit Erbe:
```
💔 Gisela 04 ist gestorben
Alter 2400/2400 · Todesursache: Altersschwäche

Erbin gefunden:
🧙‍♀️ Sara 03 (Tochter, jetzt Gen 5)
Reputation: +0.42 · Energie: 78

Sie führt die Linie als Gisela 05 fort.

[Lebenslauf von Gisela 04 ansehen]  [Übernahme bestätigen]
```

Ohne Erbe (kinderlos):
```
💀 Familie Gisela ausgestorben
Letzter Träger: Gisela 04, Alter 1240, Todesursache: Hunger
Kein lebender Nachfahre.

Ein Nachfolger wagt einen Neuanfang. Verlust:
🎨 Künstler:in — Bild-Generation nicht mehr verfügbar
Du musst es neu erspielen.

[Klon spawnen und weiter]
```

**Stufe 3 (Telegram, parallel):**

Wenn TTS-Tool freigeschaltet: Voice-Message vom Träger ("Mama ist heute gestorben. Ich übernehme.").
Sonst: Text-Message mit gleichem Inhalt.

## Subsystem 3 — Tool-Universum

### Tool-Layer-Architektur

`telegram-webhook` wird erweitert:

```typescript
async function handleMessage(msg, user, agent) {
  // 1. Verfügbare Tools für diesen User aus dynasty_achievements lesen
  const tools = await getAvailableTools(user.id)
  
  // 2. LLM aufrufen mit Tools-Spec
  const llmResponse = await queryLLM(prompt, { tools })
  
  // 3. Tool-Call ausführen falls vorhanden
  if (llmResponse.tool_call) {
    const result = await invokeTool(llmResponse.tool_call.name, 
                                     llmResponse.tool_call.params, 
                                     user, agent)
    // 4. LLM-Folgecall mit Tool-Result
    const finalResponse = await queryLLM(promptWithResult)
    await sendTelegram(user.chat_id, finalResponse.text)
  } else {
    await sendTelegram(user.chat_id, llmResponse.text)
  }
}
```

### Tool-Implementierung — Konvention

Jeder Tool ist eine eigenständige Edge Function unter `supabase/functions/tools/<tool_id>/index.ts`. Signatur:

```typescript
// supabase/functions/tools/web_search/index.ts
import { ToolContext, ToolResult } from "../_shared/types.ts"

export default async function(ctx: ToolContext, params: { query: string }): Promise<ToolResult> {
  // ctx.user, ctx.agent, ctx.supabase verfügbar
  const res = await fetch(`https://api.duckduckgo.com/?q=${params.query}&format=json`)
  const data = await res.json()
  return { text: data.AbstractText, citations: [data.AbstractURL] }
}
```

`telegram-webhook` lädt Tools dynamisch per Konvention (Tool-ID → Function-Name). Auf Supabase Edge Functions geht das durch direkten Function-Invoke via Service-Role-Key (`functions.invoke`).

### Tool-Katalog (Erste Welle = Tier 1, alle Built-in)

Implementierungs-Reihenfolge:

1. **`web_search`** — DuckDuckGo Instant Answer API (no key, kein Limit)
2. **`reminder_set` + Cron-Worker** — Insert in `agent_reminders`, neuer pg_cron-Job ruft jede Minute Webhook auf
3. **`shopping_list`** — Neue Tabelle `user_lists`, einfache add/remove-Operationen
4. **`weather`** — Open-Meteo API, User-Location aus Telegram-Profil oder per Frage
5. **`recipe_helper`** — LLM-only Tool (kein externer Call), nutzt User's LLM-Key
6. **`travel_info`** — DuckDuckGo-Suche mit Travel-Prompt-Template

Tier 2-4 in nachfolgenden Iterations-Phasen.

### Permission-Check

Jeder Tool-Edge-Function prüft am Eingang:

```typescript
const hasAchievement = await ctx.supabase
  .from('dynasty_achievements')
  .select('achievement_id')
  .eq('user_id', ctx.user.id)
  .eq('achievement_id', getAchievementForTool(toolId))
  .single()

if (!hasAchievement.data) {
  return { error: "Tool noch nicht freigeschaltet." }
}
```

Aber: Im Webhook ist die Tools-Liste schon gefiltert, also tritt dieser Fall nur bei direkten Funktionsaufrufen auf (z.B. manueller Test).

### Key-Management (Erweiterte Tools)

**Mapping von Tools zu Keys:**

| Tool | profile-Spalte | Wo Key holen |
|---|---|---|
| `llm_chat`, `recipe_helper`, `decision_helper`, ... (LLM-basiert) | `llm_api_key` (existiert schon) | nvidia.com / groq.com / openrouter.ai |
| `voice_stt` (Sprache → Text) | `groq_api_key` | groq.com (kostenlos, Whisper-Endpoint) |
| `email_send` (echte Email senden) | `resend_api_key` | resend.com (100 Mails/Tag gratis) |
| `image_generate` | `huggingface_key` | huggingface.co (kostenlos, mit Limits) |

User trägt diese Keys in `/dashboard` → "⚙ Tools" → "Erweiterte Setup" ein. Beim Tool-Call:

```typescript
if (tool.key_class === 'extended') {
  const requiredKey = TOOL_KEY_MAPPING[tool.id]  // z.B. 'groq_api_key'
  const userKey = ctx.user[requiredKey]
  if (!userKey) {
    return { 
      text: "Dieser Tool braucht einen kostenlosen Groq-Key. " +
            "Hol dir einen auf groq.com (2 Min) und trag ihn in den Einstellungen ein. " +
            "Direkt-Link: {APP_URL}/dashboard?tab=tools&setup=groq"
    }
  }
}
```

### Rate-Limiting

Pro User pro Tool pro Tag, gespeichert in einer neuen Tabelle:

```sql
CREATE TABLE tool_usage_log (
  user_id UUID NOT NULL,
  tool_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT DEFAULT 1,
  PRIMARY KEY (user_id, tool_id, date)
);
```

Default-Limit: 50 Aufrufe pro Tool pro Tag. Überschreitung → freundliche Meldung, Reset um Mitternacht.

## Datenfluss-Übersicht

```
User schreibt in Telegram
   ↓
telegram-webhook (Edge Function)
   ↓
1. Lade Agent (mit dynasty-Info) + User-Profile + Tool-Liste
2. Sende LLM-Prompt mit Tools-Spec
   ↓
LLM-Provider (User's Key oder shared NVIDIA)
   ↓
Tool-Call? → Lade & rufe Tool-Edge-Function
            → Result zurück an LLM
            → Final-Antwort
   ↓
Sende Telegram-Antwort
   ↓
Insert in agent_messages (Realtime → WebChat)


Simulation-Tick (alle 60 Sek, intern 10× 6-Sek-Loop)
   ↓
Pro Tick:
1. Aktionen ausführen
2. Tod prüfen → ggf. Erbsuche / Klon-Spawn → Notification
3. Achievement-Engine: prüfe Bedingungen, unlock falls erfüllt
4. World-State zurückschreiben
   ↓
Realtime-Push an Frontend
   ↓
WorldCanvas + CharacterHUD + FamilyTicker re-rendern
```

## Implementierungs-Phasierung

**Phase A — Dynastie-Kern (Subsystem 1):**
- Migration `008_dynasty_redesign.sql`
- Seed-Migration mit 20 Achievement-Definitionen
- `simulation-tick` Erweiterung: Achievement-Engine + Erbsuche + Klon-Spawn
- Telegram-Notifications für Achievement-Unlock und Tod/Succession
- Frontend: Configurator erweitern um Dynasty-Name + Emoji
- Frontend: Dashboard zeigt main_agent_id + Achievement-Liste (read-only)

**Phase B — UI-Overhaul (Subsystem 2):**
- CharacterHUD-Komponente
- WorldCanvas: Glow-Outline für Hauptchar + Familie-Rand
- FamilyTicker
- Tod-Modal mit 3-Stufen-Sequenz
- Dashboard-Tabs (Stammbaum, Chronik, Erfolge, Tools)
- Emoji-Avatar-System auf Karte

**Phase C — Tool-Universum (Subsystem 3):**
- `_shared/types.ts` + Tool-Dispatcher in `telegram-webhook`
- 6 Tier-1-Tools (Web-Suche, Erinnerungen, Liste, Wetter, Rezepte, Reise)
- Rate-Limiting-System
- Key-Setup-UI im Dashboard
- Iterativ: Tier 2 → Tier 3 → Tier 4 (jedes Tool ist ein eigener kleiner Plan)

## Free-Tier-Budget (geschätzt)

| Ressource | Limit | Erwarteter Verbrauch | Headroom |
|---|---|---|---|
| Supabase DB | 500 MB | ~30 MB (200 User, je 5 Agenten + Memory) | 94% |
| Edge Functions | 500K/Monat | ~150K (sim-tick + webhook + tools) | 70% |
| Storage (für Voice-Audio) | 1 GB | ~100 MB (rolling 7 Tage TTL) | 90% |
| Realtime | 200 concurrent | ~50 User | OK |
| Netlify Build | 300 min/Monat | ~30 min | OK |

## Was nicht im Spec ist (bewusst out-of-scope)

- **3D-Globus**: Bleibt unangetastet, ggf. später visuelles Refresh.
- **Browser-Automatisierung via MCP**: Gestrichen — nicht für alle User verfügbar.
- **Code-Ausführung als Tool**: Reduziert auf Mathe-Expression-Evaluator (safe Subset, kein generischer Code).
- **Mehrere Hauptcharaktere pro User**: 1 Dynasty pro User. Multi-Dynasty als Future Work.
- **Cross-User-Allianzen**: Aktuell schon vorhanden, bleibt wie es ist.

## Risiken & offene Fragen

- **Edge-TTS-Endpoint** ist inoffiziell (Microsoft Edge Browser Read-Aloud). Könnte ohne Vorwarnung abgeschaltet werden. Fallback: User-eigener ElevenLabs-Key (erweitertes Tool).
- **DuckDuckGo Instant Answer API** liefert oft leere Resultate. Fallback: Wikipedia-API für Begriffs-Lookups.
- **Achievement-Loss-Schmerz**: Möglicherweise zu hart wenn ein wichtiger Tool weg ist. Beobachten, ggf. später: "Zweite Chance"-Mechanik (Tool kann durch ein anderes Achievement reaktiviert werden).
- **Sim-Tick-Performance**: Achievement-Engine läuft pro lebendem Agent pro Tick — bei vielen Usern könnte das langsam werden. Mitigation: Achievements werden nur für `main_agent` jedes Users gecheckt, nicht alle Agenten.

## Erfolgsmetriken

Ein erfolgreicher Re-Design heißt:
1. User versteht innerhalb von 5 Sekunden, was mit seinem Charakter los ist (HUD).
2. Tod fühlt sich nach Verlust und Übergang an, nicht nach Reset.
3. User hat einen Grund, in die nächste Woche zurückzukommen (weiteres Achievement, Familienzuwachs).
4. Mindestens 1 freigeschalteter Tool wird tatsächlich im Alltag verwendet (Web-Suche oder Erinnerung — die simpelsten).
