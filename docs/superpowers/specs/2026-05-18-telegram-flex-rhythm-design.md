# Telegram-Chat & Flexibler Tagesrhythmus — Design Spec

## Kontext

Earth 0.1 ist eine persistente Welt, in der KI-Agenten leben und evolvieren. Die Agenten sollen nicht nur in der Simulation existieren, sondern dem User auch als persoenlicher Assistent dienen. Sub-Projekt 1 macht Agenten per Telegram erreichbar und fuehrt einen flexiblen Tagesrhythmus ein, damit der Agent sofort reagiert wenn der User schreibt.

**Vision:** Earth 0.1 wird eine vollstaendige Agenten-Plattform. Die Simulation ist das Trainingsprogramm, in der Freizeit dient der Agent dem User. Telegram ist der erste Kommunikationskanal.

**Sub-Projekt-Reihenfolge:**
1. **Dieses Spec:** Telegram-Chat + flexibler Rhythmus (Agent kann chatten, Zustand berichten, erinnern)
2. Skill-System + erste Tools (Websuche, Notizen) — Agent lernt in der Simulation, setzt Skills fuer den User ein
3. Volle Tool-Plattform (Kalender, Kontakte, Automatisierungen)

## Entscheidungen

- **Architektur:** Webhook pro User-Bot (jeder User erstellt eigenen Telegram-Bot)
- **LLM fuer Chat:** Gemini Free API server-seitig (1000 Calls/Tag Budget fuer Chat)
- **Rhythmus:** Per-Agent Tick-Counter statt globaler Phase
- **Scope:** Chat + Status + Erinnerungen. Keine Tool-Ausfuehrung im MVP.

---

## 1. Flexibler Tagesrhythmus

### Ist-Zustand

Globale Phase via `tick % 240` — alle Agenten gleichzeitig in work/free/sleep.

### Neu: Per-Agent Phase Tracking

Neue Felder in `agents`-Tabelle:

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `schedule_mode` | TEXT | 'auto' | 'auto' oder 'manual' |
| `work_ticks` | INT | 0 | Arbeitsticks im aktuellen Zyklus |
| `free_ticks` | INT | 0 | Freizeitticks im aktuellen Zyklus |
| `sleep_ticks` | INT | 0 | Schlafticks im aktuellen Zyklus |
| `cycle_start_tick` | BIGINT | 0 | Beginn des aktuellen 24h-Zyklus |
| `forced_phase` | TEXT | null | 'free' bei User-Interrupt, null sonst |

### Phasen-Logik in simulation-tick

Pro Tick wird fuer jeden Agent individuell bestimmt:

1. **Zyklusreset:** Wenn `tick - cycle_start_tick >= 240` dann alle Zaehler auf 0, `cycle_start_tick = tick`
2. **User-Interrupt:** Wenn `forced_phase = 'free'` dann Agent ist in Freizeit (unabhaengig von Zaehlern)
3. **Auto-Modus Prioritaeten:**
   - Energie < 20 → Schlaf erzwungen (Notfall-Regeneration)
   - `sleep_ticks < 80` UND Zyklus hat < 80 Ticks uebrig → Schlaf erzwungen (8h muessen zusammenkommen)
   - Sonst: Agent waehlt basierend auf Personality und Bedarf
     - Hohe `priority` → bevorzugt Arbeit
     - Hohe `social_mode` → bevorzugt Freizeit
     - Balance: Verteilt automatisch auf ~80/80/80
4. **Tick-Zaehler:** Nach Phase-Bestimmung wird der entsprechende Zaehler inkrementiert (`work_ticks++`, `free_ticks++`, oder `sleep_ticks++`)

### User-Interrupt-Flow

```
User schreibt Telegram-Nachricht
  -> Webhook setzt Agent.forced_phase = 'free'
  -> Agent beendet aktuelle Simulations-Aktion (aktueller Tick laeuft fertig)
  -> Naechster Tick: Agent ist in Freizeit
  -> Nach 5 Minuten (50 Ticks) ohne User-Nachricht: forced_phase = null
  -> Agent kehrt zur normalen Phase zurueck
```

### Effekt

- Nicht alle Agenten schlafen gleichzeitig
- Jeder hat seinen eigenen Rhythmus basierend auf Personality
- User-Anfrage = sofortige Verfuegbarkeit
- 8h/8h/8h pro 24h wird trotzdem eingehalten

---

## 2. Datenbank-Aenderungen

### Neue Spalten in `profiles`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `telegram_bot_token` | TEXT | Bot-Token vom BotFather |
| `telegram_chat_id` | TEXT | Chat-ID, beim ersten /start gesetzt |
| `telegram_linked_at` | TIMESTAMPTZ | Wann Bot verknuepft wurde |
| `telegram_webhook_secret` | TEXT | Zufalls-ID fuer Webhook-URL-Schutz |

### Neue Tabelle: `agent_messages`

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('user', 'agent')),
  content TEXT NOT NULL,
  tick BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_agent ON agent_messages(agent_id, created_at DESC);
```

RLS: Nur Owner des Agents kann lesen/schreiben (via Join auf agents.owner_id).

Cleanup: Daily-Cron loescht Nachrichten aelter als 200 pro Agent.

### Aenderungen an `agents`

6 neue Spalten fuer flexiblen Rhythmus (siehe Abschnitt 1).

---

## 3. Telegram-Setup-Flow

### User-Perspektive

1. User oeffnet Dashboard → "Telegram verbinden"
2. Aufklappbare Anleitung:
   - Oeffne @BotFather in Telegram
   - Sende `/newbot`
   - Waehle Anzeigenamen (z.B. Agent-Name)
   - Waehle Username (z.B. `mein_agent_bot`)
   - Kopiere den Token
3. User fuegt Token ins Eingabefeld ein, klickt "Verbinden"
4. System validiert Token, setzt Webhook, zeigt Erfolg
5. User oeffnet Bot in Telegram, sendet `/start`
6. Agent antwortet: "Hallo! Ich bin [Name]. Schreib mir wenn du was brauchst."

### Technischer Flow

```
Frontend: POST /register-telegram { token }
  -> Edge Function:
     1. Auth pruefen (Bearer Token)
     2. Telegram API: getMe(token) -> Bot-Info validieren
     3. webhook_secret generieren (crypto.randomUUID)
     4. Telegram API: setWebhook(token, url + ?secret=webhook_secret)
     5. profiles UPDATE: telegram_bot_token, telegram_webhook_secret, telegram_linked_at
     6. Response: { ok: true, bot: { name, username } }
```

Webhook-URL Format:
```
https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/telegram-webhook?secret={webhook_secret}
```

### Trennen

```
Frontend: POST /unregister-telegram
  -> Edge Function:
     1. Auth pruefen
     2. Token aus Profil laden
     3. Telegram API: deleteWebhook(token)
     4. profiles UPDATE: alle telegram_* Felder auf null
     5. Response: { ok: true }
```

---

## 4. Telegram-Webhook Edge Function

### Empfang & Routing

```
POST /telegram-webhook?secret={secret}
  1. secret gegen profiles.telegram_webhook_secret matchen -> User finden
  2. Falls kein Match: 401
  3. chat_id aus Update extrahieren
  4. Falls profiles.telegram_chat_id leer: speichern (erster /start)
  5. Message-Text extrahieren
  6. Aktiven Agent waehlen:
     - Alle alive Agents des Users laden
     - Agent mit hoechster Energie waehlen (der "fitteste")
     - Falls nur 1 Agent: diesen nehmen
     - Falls 0 Agents alive: Fallback-Antwort ("Du hast keinen lebenden Agenten")
```

**Hinweis:** Bei 2 Agenten antwortet immer der mit der hoechsten Energie. Ein `/switch`-Command fuer explizite Auswahl kann spaeter ergaenzt werden.

### Slash-Commands (kein LLM noetig)

| Command | Aktion | Antwort-Beispiel |
|---------|--------|-----------------|
| `/start` | chat_id speichern, Begruessung | "Hallo! Ich bin Luna, Generation 3. Schreib mir!" |
| `/status` | Agent-Zustand aus DB | "Energie: 72/100, Position: (15,8) Savanne, Phase: Arbeit" |
| `/world` | Welt-Zusammenfassung | "Tag 42, Sommer. 28 Agenten leben. Letzte Katastrophe: Sturm bei (5,12)" |
| `/memory` | Letzte 5 Erinnerungen | "1. Habe mit Rex Nahrung geteilt... 2. Sturm hat mein Shelter zerstoert..." |
| `/sleep` | forced_phase = null, Schlaf | "Ich lege mich hin. Gute Nacht!" |
| `/work` | forced_phase = null, Arbeit | "Zurueck an die Arbeit! Bis spaeter." |

### Chat-Nachrichten (LLM-Antwort)

Fuer normale Textnachrichten (keine Commands):

1. Nachricht in `agent_messages` speichern (direction: 'user')
2. `forced_phase = 'free'` setzen auf dem Agent
3. Kontext laden:
   - Letzte 10 Chat-Nachrichten aus agent_messages
   - Agent: name, personality, energy, position, generation, age
   - Letzte 5 Langzeit-Erinnerungen
   - Welt: Saison, Tick, Agenten-Population
4. Chat-Prompt bauen (siehe Template unten)
5. Gemini Free API Call (server-seitig, max 300 Tokens)
6. Antwort in agent_messages speichern (direction: 'agent')
7. Antwort via Telegram `sendMessage` zuruecksenden

### Chat-Prompt-Template

```
Du bist {name}, ein Agent in der Welt Earth 0.1.
Generation {generation}, Alter {age} Ticks, Reputation {reputation}.

Deine Persoenlichkeit:
- Kooperation: {cooperation} (0=egoistisch, 1=hilfsbereit)
- Neugier: {curiosity} (0=fokussiert, 1=neugierig)
- Risikobereitschaft: {risk_tolerance} (0=vorsichtig, 1=mutig)
- Sozialverhalten: {social_mode} (0=einzelgaenger, 1=gesellig)

Dein aktueller Zustand:
- Energie: {energy}/100
- Position: ({x}, {y}), {terrain_description}
- Saison: {season}, Tag {day_number}

Erinnerungen:
{recent_memories}

Bisheriger Chat:
{chat_history}

Antworte kurz (1-3 Saetze), freundlich und in character.
Du bist kein generischer Chatbot — du bist ein Wesen mit
Erfahrungen aus der Simulation. Beziehe dich auf dein Leben
wenn es passt. Antworte auf Deutsch.
```

### Budget & Rate-Limiting

- Gemini Free: 1500 Calls/Tag gesamt
- Aufteilung: 500 fuer Simulation, 1000 fuer Chat
- Rate-Limit: Max 10 Nachrichten pro Minute pro User
- Wenn Budget leer: Agent antwortet mit Fallback-Text ohne LLM
  - "Ich bin gerade erschoepft und brauche eine Pause. Versuch es spaeter nochmal!"
- User mit eigenem LLM (Dashboard-Config): kein Limit, deren API wird genutzt

---

## 5. Frontend-Aenderungen

### Neue Komponenten

**`src/components/TelegramSetup.jsx`**
- Token-Eingabefeld + "Verbinden"-Button
- Status: Nicht verbunden / Verbunden (@botname)
- "Trennen"-Button
- Aufklappbare BotFather-Anleitung
- Eingebettet im Dashboard

**`src/components/AgentChat.jsx`**
- Read-only Chat-Verlauf aus agent_messages
- Zeigt User- und Agent-Nachrichten in Chat-Bubble-Layout
- Auto-Refresh via Realtime-Subscription auf agent_messages
- Eingebettet als Tab in der Agent-Detail-Ansicht

### Modifizierte Dateien

**`src/pages/Dashboard.jsx`**
- TelegramSetup-Komponente einbinden

**`src/pages/Knowledge.jsx`**
- Neuer Abschnitt: "Telegram-Bot erstellen" mit ausfuehrlicher Schritt-fuer-Schritt-Anleitung

**`src/lib/worldService.js`**
- `registerTelegram(token)` — POST /register-telegram
- `unregisterTelegram()` — POST /unregister-telegram
- `fetchAgentMessages(agentId, limit=50)` — Letzte 50 Nachrichten
- `subscribeToMessages(agentId, callback)` — Realtime auf agent_messages

**`src/lib/agentBrain.js`**
- Neues Export: `buildChatPrompt(agent, messages, memories, worldState)` — Chat-spezifisches Prompt-Template (kompakter als Simulations-Prompt)

---

## 6. Edge Functions Uebersicht

| Function | Trigger | Auth | Beschreibung |
|----------|---------|------|-------------|
| `register-telegram` | POST | Bearer | Token validieren, Webhook setzen, in DB speichern |
| `telegram-webhook` | POST | secret-Param | Nachrichten empfangen, Commands/Chat verarbeiten, antworten |
| `unregister-telegram` | POST | Bearer | Webhook entfernen, Token loeschen |
| `simulation-tick` | pg_cron | service_role | UMBAU: Flexibler Rhythmus pro Agent |

---

## 7. Dateien-Uebersicht

| Datei | Aktion |
|-------|--------|
| `supabase/migrations/002_telegram_flex_rhythm.sql` | NEU — Schema-Erweiterung |
| `supabase/functions/register-telegram/index.ts` | NEU — Bot-Registrierung |
| `supabase/functions/telegram-webhook/index.ts` | NEU — Webhook-Handler |
| `supabase/functions/unregister-telegram/index.ts` | NEU — Bot-Trennung |
| `supabase/functions/simulation-tick/index.ts` | UMBAU — Flexibler Rhythmus |
| `src/components/TelegramSetup.jsx` | NEU — Setup-UI im Dashboard |
| `src/components/AgentChat.jsx` | NEU — Chat-Verlauf (read-only) |
| `src/pages/Dashboard.jsx` | UMBAU — TelegramSetup einbinden |
| `src/pages/Knowledge.jsx` | UMBAU — Bot-Anleitung |
| `src/lib/worldService.js` | UMBAU — Telegram + Messages API |
| `src/lib/agentBrain.js` | UMBAU — Chat-Prompt-Template |

## Nicht im Scope

- Tool-Ausfuehrung (Websuche, Kalender, Code) — Sub-Projekt 2
- Skill-Learning in der Simulation — Sub-Projekt 2
- Mehrere Agenten pro User mit verschiedenen Bots — spaeter
- Web-Chat im Frontend (User kann Agent auch im Browser schreiben) — spaeter
- Sprach-Nachrichten — spaeter
- Gruppen-Chats — spaeter
