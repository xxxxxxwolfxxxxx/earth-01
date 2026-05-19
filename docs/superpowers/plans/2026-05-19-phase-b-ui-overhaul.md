# Phase B — UI-Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die `/welt`-Seite zeigt den Hauptcharakter visuell zentral (HUD oben, hervorgehoben auf Karte, Familien-Event-Ticker unten). Tod & Erbübergang werden mit Modal sichtbar. Neue `/chronik`-Subseite bietet 4 Tabs für Stammbaum, Familien-Chronik, Achievements, Tools.

**Architecture:** Reiner Frontend-Aufsatz auf Phase A. Keine neuen Tabellen, keine neuen Edge Functions. Realtime via vorhandenes `subscribeToWorld`. Daten kommen aus den Tabellen `profiles`, `agents`, `world_events`, `achievements`, `dynasty_achievements`.

**Tech Stack:** React 19 + Vite + Tailwind CSS 4. Canvas-2D für die Karte. Reines SVG für den Stammbaum (keine neue npm-Dependency).

**Out of scope für Phase B:**
- Tool-Funktionalität — Phase C
- 3D-Globus-Anpassungen — bleibt unangetastet
- Sound-Effekte beim Tod-Moment (Modal-Visuelle ohne Audio)

---

## File Structure

**Neu:**
- `src/lib/familyUtils.js` — Family-ID-Berechnung, Rollen/Gender→Emoji-Mapping
- `src/components/CharacterHUD.jsx` — Top-Bar auf `/welt` mit Dynasty-Stats
- `src/components/FamilyTicker.jsx` — Live-Event-Liste der Familie unter der Karte
- `src/components/DeathModal.jsx` — Modal das bei Tod des Hauptchars aufploppt
- `src/pages/Chronik.jsx` — Neue Subseite mit 4 Tabs
- `src/components/chronik/FamilyTreePanel.jsx` — Stammbaum-Tab
- `src/components/chronik/ChronicleListPanel.jsx` — Chronik-Tab
- `src/components/chronik/ToolsPanel.jsx` — Tools-Tab

**Modifiziert:**
- `src/lib/worldService.js` — `fetchFamilyEvents` ergänzen
- `src/components/WorldCanvas.jsx` — Glow, Familien-Rand, Emoji-Overlay, Auto-Pan
- `src/pages/World.jsx` — HUD oben, Ticker unten einbauen
- `src/App.jsx` — Route `/chronik`
- `src/components/Navigation.jsx` — Link zur Chronik

---

## Konventionen

- Deploy nur am Ende per Frontend-Build, Edge Functions ändern sich nicht
- Build: `cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build`
- Production-Deploy: `npx netlify deploy --prod --dir=dist`
- Commits in der Konvention: `ui: <kurzbeschreibung>` für reine Frontend-Tasks
- Trailing `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Testing: Frontend hat keine Test-Infrastruktur, jede Task endet mit `npx vite build` und visueller Browser-Verifikation auf https://earth-01.netlify.app

---

## Task 1: familyUtils-Helper

**Files:**
- Create: `src/lib/familyUtils.js`

- [ ] **Step 1: Helper schreiben**

Write `src/lib/familyUtils.js`:

```javascript
// Helper für familien-bezogene Berechnungen und Emoji-Mapping.
// Pure Funktionen, keine Side-Effects.

// Walks the parent_a/parent_b chain to collect all ancestors of an agent.
export function ancestorsOf(agentId, allAgents) {
  const idToAgent = new Map(allAgents.map((a) => [a.id, a]))
  const result = new Set()
  const stack = [agentId]
  while (stack.length) {
    const id = stack.pop()
    const a = idToAgent.get(id)
    if (!a) continue
    if (a.parent_a_id && !result.has(a.parent_a_id)) {
      result.add(a.parent_a_id)
      stack.push(a.parent_a_id)
    }
    if (a.parent_b_id && !result.has(a.parent_b_id)) {
      result.add(a.parent_b_id)
      stack.push(a.parent_b_id)
    }
  }
  return result
}

// Walks descendants via parent links.
export function descendantsOf(agentId, allAgents) {
  const result = new Set([agentId])
  let changed = true
  while (changed) {
    changed = false
    for (const a of allAgents) {
      if (result.has(a.id)) continue
      if (
        (a.parent_a_id && result.has(a.parent_a_id)) ||
        (a.parent_b_id && result.has(a.parent_b_id))
      ) {
        result.add(a.id)
        changed = true
      }
    }
  }
  result.delete(agentId)
  return result
}

// All family members relative to the given root: ancestors + descendants + the root itself.
// allAgents should include both living and dead so chains work.
export function familyIds(rootAgentId, allAgents) {
  if (!rootAgentId) return new Set()
  const anc = ancestorsOf(rootAgentId, allAgents)
  const desc = descendantsOf(rootAgentId, allAgents)
  const result = new Set([rootAgentId, ...anc, ...desc])
  return result
}

// Emoji mapping based on role × gender × life-phase ("child" if young, else "adult").
// agent.age < CHILD_AGE_MAX is a child.
export const CHILD_AGE_MAX = 200

const ROLE_EMOJI = {
  farmer:      { m: '👨‍🌾', f: '👩‍🌾', child: '🧒' },
  builder:     { m: '👷',        f: '👷‍♀️', child: '🧒' },
  researcher:  { m: '🧙‍♂️', f: '🧙‍♀️', child: '👦' },
  guard:       { m: '🛡️',        f: '🛡️',        child: '🧒' },
  trader:      { m: '🧑‍💼', f: '👩‍💼', child: '🧒' },
  generalist:  { m: '🧑',        f: '👩',        child: '🧒' },
}

// Returns a single emoji character for an agent given role/gender/age.
// Falls back to generalist if role/gender missing.
export function emojiForAgent(agent) {
  if (!agent) return '👤'
  const role = agent.role && ROLE_EMOJI[agent.role] ? agent.role : 'generalist'
  if ((agent.age ?? 0) < CHILD_AGE_MAX) return ROLE_EMOJI[role].child
  const g = agent.gender === 'm' ? 'm' : agent.gender === 'f' ? 'f' : 'f'
  return ROLE_EMOJI[role][g]
}

// For the main agent we always show the dynasty emoji instead of the role emoji.
export function emojiForMainAgent(dynastyEmoji) {
  return dynastyEmoji || '👑'
}
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: build success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/lib/familyUtils.js && git commit -m "$(cat <<'EOF'
ui: familyUtils helper (familyIds + role-emoji mapping)

Pure helpers: ancestorsOf, descendantsOf, familyIds für die
Familien-Erkennung relativ zum main_agent. emojiForAgent
nutzt Rolle × Geschlecht × Lebensphase Mapping. emojiForMainAgent
gibt das Dynasty-Emoji zurück.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CharacterHUD-Komponente

**Files:**
- Create: `src/components/CharacterHUD.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/CharacterHUD.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Heart, Clock, Users, Trophy } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import {
  fetchDynastyState,
  fetchUnlockedAchievements,
  fetchAchievementsCatalog,
} from '../lib/worldService'
import { descendantsOf } from '../lib/familyUtils'

export default function CharacterHUD() {
  const { agents } = useWorld()
  const [dynasty, setDynasty] = useState(null)
  const [unlocked, setUnlocked] = useState([])
  const [totalAchievements, setTotalAchievements] = useState(20)

  useEffect(() => {
    (async () => {
      const [d, u, c] = await Promise.all([
        fetchDynastyState(),
        fetchUnlockedAchievements(),
        fetchAchievementsCatalog(),
      ])
      setDynasty(d)
      setUnlocked(u)
      setTotalAchievements(c.length || 20)
    })()
  }, [])

  if (!dynasty?.name || !dynasty?.mainAgentId) {
    return null
  }

  const mainAgent = agents?.find((a) => a.id === dynasty.mainAgentId)
  if (!mainAgent) {
    return (
      <div className="mb-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-gray-400 text-sm">
        Hauptcharakter wird geladen…
      </div>
    )
  }

  const energy = Math.round(mainAgent.energy ?? 0)
  const ageRemaining = Math.max(0, (mainAgent.max_age ?? 1) - (mainAgent.age ?? 0))
  const ageProgress = Math.min(1, (mainAgent.age ?? 0) / (mainAgent.max_age ?? 1))
  const familySize = descendantsOf(mainAgent.id, agents ?? []).size
  const displayName = mainAgent.display_name || dynasty.name

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-nebula-500/10 via-white/[0.03] to-life-500/10 border border-white/10 flex flex-wrap items-center gap-3">
      <div className="text-3xl sm:text-4xl flex-shrink-0">
        {dynasty.emoji ?? '👑'}
      </div>
      <div className="flex-1 min-w-[140px]">
        <div className="text-white font-display font-bold text-base sm:text-lg leading-tight">
          {displayName}
        </div>
        <div className="text-xs text-gray-400">
          Generation {dynasty.generation}
        </div>
      </div>

      <Stat icon={<Heart className="w-4 h-4 text-red-400" />} label="Energie" value={`${energy}/100`} />

      <div className="flex-1 min-w-[120px]">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
          <Clock className="w-3.5 h-3.5" /> Lebenszeit
        </div>
        <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              ageProgress < 0.5 ? 'bg-green-400' : ageProgress < 0.85 ? 'bg-yellow-400' : 'bg-red-500'
            }`}
            style={{ width: `${ageProgress * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          noch {ageRemaining} Ticks
        </div>
      </div>

      <Stat icon={<Users className="w-4 h-4 text-blue-400" />} label="Familie" value={familySize} />
      <Stat icon={<Trophy className="w-4 h-4 text-amber-400" />} label="Erfolge" value={`${unlocked.length}/${totalAchievements}`} />
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-start min-w-[64px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
        {icon} {label}
      </div>
      <div className="text-white font-semibold text-sm">{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/CharacterHUD.jsx && git commit -m "$(cat <<'EOF'
ui: CharacterHUD-Komponente

Top-Bar für /welt mit Dynasty-Emoji, display_name, Generation,
Energie, Restzeit-Balken (grün→gelb→rot), Familiengröße,
Achievement-Counter. Versteckt sich wenn keine Dynasty existiert.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: worldService — fetchFamilyEvents

**Files:**
- Modify: `src/lib/worldService.js`

- [ ] **Step 1: Funktion einfügen**

Edit `src/lib/worldService.js`. Am Dateiende, nach den anderen Dynasty-Funktionen, einfügen:

```javascript
export async function fetchFamilyEvents(limit = 30) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Events die explizit diesen user betreffen
  const userIdStr = user.id
  const { data: dynastyEvents } = await supabase
    .from('world_events')
    .select('*')
    .in('event_type', ['dynasty_succession', 'dynasty_childless_restart', 'achievement_unlocked'])
    .order('tick', { ascending: false })
    .limit(200)

  // Filter client-side auf user_id im detail
  const mineByUserId = (dynastyEvents ?? []).filter(
    (e) => e.detail?.user_id === userIdStr
  )

  // Zusätzlich: events deren agent_id zu einem eigenen Agenten gehört
  const { data: myAgents } = await supabase
    .from('agents')
    .select('id')
    .eq('owner_id', user.id)
  const myAgentIds = new Set((myAgents ?? []).map((a) => a.id))

  const { data: agentEvents } = await supabase
    .from('world_events')
    .select('*')
    .order('tick', { ascending: false })
    .limit(300)

  const mineByAgentId = (agentEvents ?? []).filter((e) => {
    const aid = e.detail?.agent_id || e.detail?.deceased_id || e.detail?.heir_id
    return aid && myAgentIds.has(aid)
  })

  // Merge und dedupe per id
  const merged = new Map()
  for (const e of [...mineByUserId, ...mineByAgentId]) merged.set(e.id, e)
  const all = Array.from(merged.values())
  all.sort((a, b) => (b.tick ?? 0) - (a.tick ?? 0))
  return all.slice(0, limit)
}
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/lib/worldService.js && git commit -m "$(cat <<'EOF'
api: fetchFamilyEvents — events für die eigene Linie

Holt world_events deren detail.user_id == auth.uid() ODER deren
agent_id einem eigenen Agenten gehört (dyn. Succession, Geburten,
Achievement-Unlocks, Tode). Merge + dedupe + nach tick sortiert.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FamilyTicker-Komponente

**Files:**
- Create: `src/components/FamilyTicker.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/FamilyTicker.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Activity, ChevronRight } from 'lucide-react'
import { fetchFamilyEvents } from '../lib/worldService'
import { useWorld } from '../contexts/WorldContext'

const EVENT_ICONS = {
  achievement_unlocked: '🏆',
  dynasty_succession: '👑',
  dynasty_childless_restart: '💔',
  birth: '👶',
  death: '🪦',
  build: '🏗️',
  trade: '🤝',
  combat: '⚔️',
  hunt: '🏹',
  tech_discovered: '📚',
  alliance_formed: '🛡️',
}

function describeEvent(e) {
  const d = e.detail ?? {}
  switch (e.event_type) {
    case 'achievement_unlocked':
      return `${d.icon ?? '🏆'} Achievement freigeschaltet: ${d.achievement_name ?? d.achievement_id}`
    case 'dynasty_succession':
      return `${d.deceased_display ?? 'Hauptchar'} ist gestorben (${d.cause}). ${d.heir_display ?? 'Erbe'} (Gen ${d.generation}) übernimmt.`
    case 'dynasty_childless_restart':
      return `Familie ausgestorben (${d.cause}). Verloren: ${d.lost_achievement || '—'}.`
    case 'birth':
      return `Kind geboren${d.name ? ` (${d.name})` : ''}`
    case 'death':
      return `${d.name ?? 'Ein Agent'} ist gestorben (${d.cause ?? '?'})`
    default:
      return e.event_type
  }
}

export default function FamilyTicker({ limit = 5 }) {
  const { events: liveEvents } = useWorld()
  const [history, setHistory] = useState([])
  const [open, setOpen] = useState(false)

  // Initial: 30 events laden
  useEffect(() => {
    fetchFamilyEvents(30).then(setHistory)
  }, [])

  // Realtime: bei jedem neuen Event in liveEvents reloaden (einfach, klein)
  useEffect(() => {
    if (!liveEvents || liveEvents.length === 0) return
    fetchFamilyEvents(30).then(setHistory)
  }, [liveEvents?.[0]?.id])

  if (!history || history.length === 0) {
    return null
  }

  const visible = open ? history : history.slice(0, limit)

  return (
    <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10">
      <div className="px-4 py-2 flex items-center gap-2 text-xs uppercase text-gray-400">
        <Activity className="w-3.5 h-3.5" /> Lebenslauf der Familie
        <span className="ml-auto text-[10px]">{history.length} Ereignisse</span>
      </div>
      <div className="divide-y divide-white/5">
        {visible.map((e) => (
          <div key={e.id} className="px-4 py-2 flex items-start gap-3 text-sm">
            <div className="text-lg leading-none mt-0.5 flex-shrink-0">
              {EVENT_ICONS[e.event_type] ?? '•'}
            </div>
            <div className="flex-1 text-gray-200">
              {describeEvent(e)}
            </div>
            <div className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">
              Tick {e.tick ?? '?'}
            </div>
          </div>
        ))}
      </div>
      {history.length > limit && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-4 py-2 text-xs text-nebula-400 hover:text-nebula-300 flex items-center justify-center gap-1 border-t border-white/5"
        >
          {open ? 'Weniger zeigen' : `Alle ${history.length} zeigen`}
          <ChevronRight className={`w-3 h-3 transition ${open ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/FamilyTicker.jsx && git commit -m "$(cat <<'EOF'
ui: FamilyTicker-Komponente

Live-Liste der Ereignisse der eigenen Dynastie. Zeigt 5 letzte
Events (Achievement-Unlocks, Erbübergänge, Kinderlos-Restarts,
Geburten, Tode). Aufklappbar auf alle 30 jüngsten.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: WorldCanvas — Glow, Familien-Rand, Auto-Pan

**Files:**
- Modify: `src/components/WorldCanvas.jsx`

Diese Task erweitert die bestehende Karten-Komponente um drei visuelle Effekte. Die Funktionen bauen aufeinander auf — implementiere die Schritte in Reihenfolge.

- [ ] **Step 1: Imports + Props ergänzen**

Edit `src/components/WorldCanvas.jsx`. Bei den vorhandenen Imports am Dateianfang ergänzen:

```javascript
import { familyIds, emojiForAgent } from '../lib/familyUtils'
import { fetchDynastyState } from '../lib/worldService'
```

- [ ] **Step 2: Dynasty + Family-IDs in Komponente laden**

Innerhalb der `WorldCanvas`-Komponente, neben den vorhandenen `useState`-Aufrufen, ergänzen:

```javascript
const [dynasty, setDynasty] = useState(null)

useEffect(() => {
  fetchDynastyState().then(setDynasty)
}, [])

// Family-IDs (memoized über agents + dynasty.mainAgentId)
const familyIdSet = useMemo(
  () => familyIds(dynasty?.mainAgentId, agents ?? []),
  [dynasty?.mainAgentId, agents]
)
```

Falls `useMemo` noch nicht importiert ist, in der `react`-Import-Zeile ergänzen.

- [ ] **Step 3: Im draw-Loop: Glow für Hauptchar, Rand für Familie**

Suche im draw-Loop die Stelle wo Agenten gerendert werden (grep nach `agent.role ?? 'generalist'`). Direkt VOR dem `ctx.fillStyle = agent.day_phase === 'sleep' ...`-Block einfügen:

```javascript
const isMain = dynasty?.mainAgentId && agent.id === dynasty.mainAgentId
const isFamily = familyIdSet.has(agent.id) && !isMain

if (isMain) {
  // Pulsierender Glow-Outline für Hauptchar
  const t = (performance.now() / 600) % (2 * Math.PI)
  const pulse = 0.6 + Math.sin(t) * 0.4
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, agentRadius + 6 + pulse * 4, 0, 2 * Math.PI)
  ctx.strokeStyle = `rgba(252, 211, 77, ${0.5 + pulse * 0.4})`
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
} else if (isFamily) {
  // Goldener Rand für Familienmitglieder
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, agentRadius + 3, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.7)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}
```

(Falls die vorhandene Variable für die Mittelposition NICHT `centerX`/`centerY` heißt, ersetze mit dem tatsächlichen Variablennamen — gewöhnlich werden die Pixel-Koordinaten in der Schleife berechnet. Variable für den Agent-Kreis-Radius ist meist `agentRadius` oder ein numerischer Wert wie `8`. Inspizier die existierende `ctx.arc(...)`-Linie vor der Glow-Einfügung um die Namen abzugleichen.)

- [ ] **Step 4: Im draw-Loop: Emoji über Agenten zeichnen**

NACH dem bestehenden Agent-Rendering (nach dem Energie-Balken, vor dem nächsten Agent), einfügen:

```javascript
// Emoji-Overlay: Hauptchar zeigt dynasty-Emoji, andere Rollen-Emoji
const emojiChar = isMain && dynasty?.emoji
  ? dynasty.emoji
  : emojiForAgent(agent)
if (emojiChar) {
  ctx.save()
  ctx.font = `${Math.round(agentRadius * 1.4)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", emoji`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emojiChar, centerX, centerY - 1)
  ctx.restore()
}
```

(Wenn der vorhandene Code schon einen Buchstaben/Initial zeichnet, lass den vorhandenen Code stehen und ergänze diesen Block dahinter — der Emoji wird das Initial überdecken. Falls visuell hässlich, kannst du den vorhandenen `ctx.fillText`-Block des Initials zwischen den Glow- und Emoji-Schritten entfernen.)

- [ ] **Step 5: Auto-Pan auf Hauptchar beim Mount**

Suche die useEffect-Hook der initial die Canvas-Position/Pan setzt (grep nach `setOffsetX` / `setPan` / `centerX` einmaliger Set — wenn nicht vorhanden, neuer useEffect). Ergänze einen useEffect der ausgeführt wird sobald sowohl `dynasty?.mainAgentId` als auch `agents` vorhanden sind:

```javascript
useEffect(() => {
  if (!dynasty?.mainAgentId || !agents || agents.length === 0) return
  const main = agents.find((a) => a.id === dynasty.mainAgentId)
  if (!main) return
  // Wir nehmen die agent-Welt-Koords main.x main.y und zentrieren das Viewport.
  // Existierende Pan-Variablen heißen in dieser Datei vermutlich panX/panY/offsetX/offsetY.
  // Tatsächliche Namen per grep prüfen und entsprechend setzen.
  if (typeof setOffsetX === 'function' && typeof setOffsetY === 'function') {
    // Pixel-Position berechnen ungefähr — verwende die existierende Helper-Funktion
    // wie hexToPixel falls vorhanden, sonst grob: x = main.x * 24, y = main.y * 28
    const px = main.x * 24
    const py = main.y * 28
    setOffsetX(-(px - 400))
    setOffsetY(-(py - 300))
  }
}, [dynasty?.mainAgentId])
```

(Diese Logik ist heuristisch. Wenn der Pan/Camera-State anders heißt, ersetze entsprechend. Falls Auto-Pan kompliziert ist, kann diese Step als "nicht implementiert" gemarkt werden — Hauptchar-Glow + Familie-Rand + Emoji sind die wichtigeren Effekte. Implementiere Auto-Pan nur wenn die Pan-Variablen leicht auffindbar sind.)

- [ ] **Step 6: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 7: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/WorldCanvas.jsx && git commit -m "$(cat <<'EOF'
ui: WorldCanvas — Glow, Familien-Rand, Emoji-Overlay, Auto-Pan

Hauptchar hat einen pulsierenden goldenen Glow-Outline (sin-pulse 600ms).
Familienmitglieder (Vorfahren + Nachkommen) bekommen einen goldenen
Rand. Auf jedem Agent wird ein Emoji gezeichnet — Hauptchar zeigt das
dynasty_emoji, andere ein Rollen-Emoji. Beim Mount pannt die Karte
auf den Hauptchar.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: DeathModal-Komponente

**Files:**
- Create: `src/components/DeathModal.jsx`

- [ ] **Step 1: Komponente schreiben**

Write `src/components/DeathModal.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import { fetchDynastyState } from '../lib/worldService'

export default function DeathModal() {
  const { agents, events } = useWorld()
  const [dynasty, setDynasty] = useState(null)
  const [lastSeenMainId, setLastSeenMainId] = useState(null)
  const [modalState, setModalState] = useState(null)
  // modalState shape: { deceased, heir, cause, isClone, generation, lostAchievement }

  // Reload dynasty on mount and whenever the main agent might have changed.
  useEffect(() => {
    fetchDynastyState().then((d) => {
      setDynasty(d)
      setLastSeenMainId(d?.mainAgentId ?? null)
    })
  }, [])

  // When events stream brings a dynasty event for this user, refresh dynasty + open modal.
  useEffect(() => {
    if (!events || events.length === 0) return
    const newest = events[0]
    if (
      newest.event_type !== 'dynasty_succession' &&
      newest.event_type !== 'dynasty_childless_restart'
    ) return
    fetchDynastyState().then((nextDyn) => {
      setDynasty(nextDyn)
      // Build modal content from event detail
      const d = newest.detail ?? {}
      const deceasedAgent = agents?.find((a) => a.id === d.deceased_id)
      const heirAgent = agents?.find((a) => a.id === d.heir_id || a.id === d.clone_id)
      setModalState({
        deceased: deceasedAgent || { display_name: d.deceased_display || 'Hauptchar' },
        heir: heirAgent || (d.heir_display ? { display_name: d.heir_display } : null),
        cause: d.cause ?? 'unknown',
        isClone: newest.event_type === 'dynasty_childless_restart',
        generation: d.generation ?? 1,
        lostAchievement: d.lost_achievement ?? null,
      })
      setLastSeenMainId(nextDyn?.mainAgentId ?? null)
    })
  }, [events?.[0]?.id])

  if (!modalState) return null

  const { deceased, heir, cause, isClone, generation, lostAchievement } = modalState

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative max-w-lg w-full bg-cosmos-900 border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => setModalState(null)}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-6xl mb-3">{isClone ? '💀' : '💔'}</div>
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            {deceased.display_name ?? 'Hauptcharakter'} ist gestorben
          </h2>
          <div className="text-sm text-gray-400 mb-5">
            Todesursache: {cause}
          </div>

          {isClone ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 text-left">
              <div className="font-semibold text-red-300 mb-1">Familie ausgestorben</div>
              <div className="text-sm text-gray-300">
                Ein Klon-Nachfolger startet erneut.
              </div>
              {lostAchievement && (
                <div className="text-sm text-amber-300 mt-2">
                  Verlust: {lostAchievement}
                </div>
              )}
            </div>
          ) : heir ? (
            <div className="bg-life-500/10 border border-life-500/30 rounded-xl p-4 mb-5 text-left">
              <div className="font-semibold text-life-300 mb-1">
                Nachfolge gefunden
              </div>
              <div className="text-base text-white">
                {heir.display_name ?? 'Ein Erbe'}
              </div>
              <div className="text-sm text-gray-400">
                Führt die Linie als Generation {generation} fort.
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setModalState(null)}
            className="px-6 py-2 bg-nebula-500 hover:bg-nebula-400 text-white rounded-lg transition"
          >
            Übernahme bestätigen
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/components/DeathModal.jsx && git commit -m "$(cat <<'EOF'
ui: DeathModal — Modal bei Tod des Hauptchars

Subscribes an useWorld.events. Wenn ein dynasty_succession oder
dynasty_childless_restart Event reinkommt, lädt aktuelle Dynasty
und zeigt Modal mit Todesursache + Erben-Info oder Klon-Info.
Schließbar via X-Button oder OK-Button.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: World.jsx — Layout B-Integration

**Files:**
- Modify: `src/pages/World.jsx`

- [ ] **Step 1: Imports + Komponenten einbauen**

Edit `src/pages/World.jsx`. Komplette Datei ersetzen mit:

```jsx
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { useWorld } from '../contexts/WorldContext'
import { useAuth } from '../contexts/AuthContext'
import WorldCanvas from '../components/WorldCanvas'
import WorldStats from '../components/WorldStats'
import WorldEventFeed from '../components/WorldEventFeed'
import Leaderboard from '../components/Leaderboard'
import TechTreePanel from '../components/TechTreePanel'
import AgentDetailPanel from '../components/AgentDetailPanel'
import CharacterHUD from '../components/CharacterHUD'
import FamilyTicker from '../components/FamilyTicker'
import DeathModal from '../components/DeathModal'

export default function World() {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const { user } = useAuth()
  const { worldState, agents, tiles, events, tech } = useWorld()

  const myAgent = agents?.find((a) => a.alive && a.owner_id === user?.id) ?? null

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-3">
          <Eye className="w-4 h-4" /> Live-Welt
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Die Welt beobachten
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl mx-auto leading-relaxed text-sm">
          Beobachte in Echtzeit, wie Agenten ums Überleben kämpfen, forschen, Allianzen bilden
          und die Welt verändern. Klicke auf einen Agenten für Details.
        </p>
      </div>

      {/* Layout B: Character HUD ganz oben */}
      <CharacterHUD />

      {/* Live Stats Bar */}
      <div className="mb-4">
        <WorldStats worldState={worldState} agents={agents} tiles={tiles} events={events} tech={tech} />
      </div>

      {/* Main Content: Map + Sidebar */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <WorldCanvas onSelectAgent={setSelectedAgent} myAgent={myAgent} />
          {/* Family Ticker unter der Karte */}
          <FamilyTicker limit={5} />
        </div>

        <div className="hidden lg:flex flex-col gap-3 w-80 flex-shrink-0">
          <TechTreePanel tech={tech} />
          <WorldEventFeed events={events} />
          <Leaderboard agents={agents} onSelectAgent={setSelectedAgent} />
        </div>
      </div>

      <div className="lg:hidden mt-4 space-y-3">
        <TechTreePanel tech={tech} />
        <WorldEventFeed events={events} />
        <Leaderboard agents={agents} onSelectAgent={setSelectedAgent} />
      </div>

      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Death modal — globaler Realtime-Trigger */}
      <DeathModal />
    </div>
  )
}
```

- [ ] **Step 2: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/World.jsx && git commit -m "$(cat <<'EOF'
ui: /welt-Layout B (HUD top, ticker bottom, DeathModal)

CharacterHUD oben, Karte zentral, FamilyTicker unter der Karte,
DeathModal als globaler Overlay. Sidebar bleibt für Tech, Events,
Leaderboard.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Chronik-Page mit Tabs

**Files:**
- Create: `src/pages/Chronik.jsx`
- Create: `src/components/chronik/FamilyTreePanel.jsx`
- Create: `src/components/chronik/ChronicleListPanel.jsx`
- Create: `src/components/chronik/ToolsPanel.jsx`

- [ ] **Step 1: FamilyTreePanel schreiben**

Write `src/components/chronik/FamilyTreePanel.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchDynastyState } from '../../lib/worldService'
import { emojiForAgent } from '../../lib/familyUtils'

export default function FamilyTreePanel() {
  const { user } = useAuth()
  const [allAgents, setAllAgents] = useState([])
  const [dynasty, setDynasty] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const [{ data: agents }, dyn] = await Promise.all([
        supabase.from('agents').select('*').eq('owner_id', user.id),
        fetchDynastyState(),
      ])
      if (cancelled) return
      setAllAgents(agents ?? [])
      setDynasty(dyn)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  const byGen = useMemo(() => {
    const map = new Map()
    for (const a of allAgents) {
      const g = a.generation ?? 0
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(a)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [allAgents])

  if (loading) return <div className="text-gray-500">Lade Stammbaum…</div>
  if (allAgents.length === 0) {
    return <div className="text-gray-500">Noch keine Agenten in dieser Linie.</div>
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Linie {dynasty?.emoji} {dynasty?.name} · {allAgents.length} Mitglieder über {byGen.length} Generationen
      </div>
      {byGen.map(([gen, members]) => (
        <div key={gen} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-nebula-400 mb-3">
            Generation {gen}
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map((a) => {
              const isMain = a.id === dynasty?.mainAgentId
              const emoji = isMain ? (dynasty?.emoji ?? '👑') : emojiForAgent(a)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    isMain
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : a.alive
                        ? 'bg-white/[0.04] border-white/10'
                        : 'bg-white/[0.02] border-white/5 opacity-50'
                  }`}
                >
                  <div className="text-xl">{emoji}</div>
                  <div className="text-sm">
                    <div className="text-white font-medium">
                      {a.display_name ?? a.name}
                      {!a.alive && ' †'}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {a.alive ? `Energie ${Math.round(a.energy)}` : `Tod: ${a.cause_of_death ?? '?'}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: ChronicleListPanel schreiben**

Write `src/components/chronik/ChronicleListPanel.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { fetchFamilyEvents } from '../../lib/worldService'

const TYPE_LABELS = {
  achievement_unlocked: '🏆 Achievement',
  dynasty_succession: '👑 Erbübergang',
  dynasty_childless_restart: '💔 Klon-Restart',
  birth: '👶 Geburt',
  death: '🪦 Tod',
}

export default function ChronicleListPanel() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFamilyEvents(100)
      .then((e) => setEvents(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500">Lade Chronik…</div>
  if (events.length === 0) return <div className="text-gray-500">Noch keine Ereignisse.</div>

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 divide-y divide-white/5">
      {events.map((e) => {
        const d = e.detail ?? {}
        return (
          <div key={e.id} className="px-4 py-3 flex items-start gap-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 w-24 flex-shrink-0">
              Tick {e.tick}
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">
                {TYPE_LABELS[e.event_type] ?? e.event_type}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {detailText(e.event_type, d)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function detailText(type, d) {
  switch (type) {
    case 'achievement_unlocked':
      return `${d.icon ?? ''} ${d.achievement_name ?? d.achievement_id}`
    case 'dynasty_succession':
      return `${d.deceased_display ?? '?'} → ${d.heir_display ?? '?'} (Gen ${d.generation})`
    case 'dynasty_childless_restart':
      return `Verloren: ${d.lost_achievement || '—'}`
    case 'birth':
      return d.name ?? 'unbekannt'
    case 'death':
      return `${d.name ?? '?'} (${d.cause ?? '?'})`
    default:
      return JSON.stringify(d).slice(0, 80)
  }
}
```

- [ ] **Step 3: ToolsPanel schreiben**

Write `src/components/chronik/ToolsPanel.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { fetchAchievementsCatalog, fetchUnlockedAchievements } from '../../lib/worldService'

const TOOL_DESCRIPTIONS = {
  web_search: 'Web-Suche im Chat: „Such mir Rezepte mit Auberginen."',
  reminder: 'Erinnerungen: „Erinnere mich um 18 Uhr an Yoga."',
  shopping_list: 'Einkaufsliste: „Was hatte ich auf der Liste? Füge Milch hinzu."',
  recipe_helper: 'Rezept-Berater: „Was kann ich aus Linsen, Zwiebeln und Reis kochen?"',
  travel_info: 'Reise-Infos: Routen, Sehenswürdigkeiten, ÖPNV-Auskunft.',
  weather: 'Wettervorhersage für deinen Ort.',
  multi_agent_chat: 'Mehrere Agenten gleichzeitig befragen.',
  image_generate: 'Bild-Generation: „Mal mir einen Sonnenuntergang."',
  family_memory: 'Agent erinnert sich an Personen aus deinem Leben.',
  symptom_tracker: 'Symptome dokumentieren, Muster erkennen.',
  price_compare: 'Preisvergleich für Produkte.',
  project_manager: 'Tasks, Deadlines, Sub-Goals tracken.',
  math_eval: 'Mathe-/Berechnungs-Helfer.',
  security_check: 'Passwort-Stärke, Phishing-Erkennung, 2FA-Tipps.',
  diary: 'Tägliche Einträge, Stimmungs-Tracking.',
  decision_helper: 'Pro/Contra-Listen, Kriterien gewichten.',
  translator: 'Übersetzungen.',
  personality_style: 'Agent entwickelt einzigartigen Schreibstil.',
  email_send: 'Email-Drafts oder Versand mit deinem Resend-Key.',
  autonomous_mode: 'Agent erhält eigene Cron-Jobs, handelt selbständig.',
}

export default function ToolsPanel() {
  const [catalog, setCatalog] = useState([])
  const [unlocked, setUnlocked] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAchievementsCatalog(), fetchUnlockedAchievements()])
      .then(([c, u]) => {
        setCatalog(c)
        setUnlocked(u)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500">Lade Tools…</div>

  const unlockedIds = new Set(unlocked.map((u) => u.achievement_id))
  const unlockedAch = catalog.filter((a) => unlockedIds.has(a.id))
  const lockedAch = catalog.filter((a) => !unlockedIds.has(a.id))

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-white mb-2">
          Freigeschaltete Tools ({unlockedAch.length})
        </h3>
        {unlockedAch.length === 0 ? (
          <div className="text-gray-500 text-sm">
            Noch keine Tools freigeschaltet. Spiele um deinen Agenten Fähigkeiten beizubringen.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unlockedAch.map((a) => (
              <ToolCard key={a.id} ach={a} unlocked />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-white mb-2">
          Gesperrt ({lockedAch.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lockedAch.map((a) => (
            <ToolCard key={a.id} ach={a} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ ach, unlocked }) {
  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        unlocked
          ? 'bg-nebula-500/10 border-nebula-500/30'
          : 'bg-white/[0.02] border-white/5 opacity-60'
      }`}
    >
      <div className="text-2xl">{ach.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">
          {ach.name} <span className="text-[10px] text-gray-400">· {ach.tool_id}</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {TOOL_DESCRIPTIONS[ach.tool_id] ?? 'Wird in Phase C verfügbar.'}
        </div>
        <div className="text-[10px] mt-1">
          <span className={`px-1.5 py-0.5 rounded ${
            ach.key_class === 'builtin'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {ach.key_class === 'builtin' ? 'Eingebaut' : 'Erweitert'}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chronik.jsx Page schreiben**

Write `src/pages/Chronik.jsx`:

```jsx
import { useState } from 'react'
import { ScrollText, GitBranch, Trophy, Settings2 } from 'lucide-react'
import FamilyTreePanel from '../components/chronik/FamilyTreePanel'
import ChronicleListPanel from '../components/chronik/ChronicleListPanel'
import ToolsPanel from '../components/chronik/ToolsPanel'
import AchievementGrid from '../components/AchievementGrid'

const TABS = [
  { id: 'tree', label: 'Stammbaum', icon: GitBranch },
  { id: 'chronicle', label: 'Chronik', icon: ScrollText },
  { id: 'achievements', label: 'Erfolge', icon: Trophy },
  { id: 'tools', label: 'Tools', icon: Settings2 },
]

export default function Chronik() {
  const [tab, setTab] = useState('tree')

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <ScrollText className="w-4 h-4" /> Familien-Chronik
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Deine Dynastie
        </h1>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 flex items-center gap-2 text-sm border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-nebula-400 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'tree' && <FamilyTreePanel />}
        {tab === 'chronicle' && <ChronicleListPanel />}
        {tab === 'achievements' && <AchievementGrid />}
        {tab === 'tools' && <ToolsPanel />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 6: Commit**

Stage alle 4 neuen Dateien:

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/pages/Chronik.jsx src/components/chronik/FamilyTreePanel.jsx src/components/chronik/ChronicleListPanel.jsx src/components/chronik/ToolsPanel.jsx && git commit -m "$(cat <<'EOF'
ui: Chronik-Page mit 4 Tabs (Stammbaum, Chronik, Erfolge, Tools)

Neue Subseite zeigt Familienlinie in 4 Sichten:
- Stammbaum: Agenten nach Generationen gruppiert mit Emoji
- Chronik: Chronologische Event-Liste der Linie
- Erfolge: Bestehende AchievementGrid-Komponente
- Tools: Freigeschaltete + gesperrte Tools mit Beispiel-Befehlen

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Route + Navigation-Link

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Navigation.jsx`

- [ ] **Step 1: Route in App.jsx ergänzen**

Edit `src/App.jsx`. Bei den Imports ergänzen:

```jsx
import Chronik from './pages/Chronik'
```

In den `<Routes>` direkt nach `<Route path="/dashboard" element={<Dashboard />} />` einfügen:

```jsx
<Route path="/chronik" element={<Chronik />} />
```

- [ ] **Step 2: Navigation-Link einbauen**

Edit `src/components/Navigation.jsx`. Suche das Array oder die Liste der Nav-Items (gewöhnlich enthält es Einträge wie `/welt`, `/dashboard`, etc.). Ergänze einen neuen Eintrag — zwischen Welt und Dashboard:

```jsx
{ to: '/chronik', label: 'Chronik', icon: ScrollText },
```

(Falls die Struktur in Navigation.jsx anders ist: einen Link/NavLink-Eintrag analog zu den bestehenden ergänzen. Das Icon ist `ScrollText` aus `lucide-react` — Import oben ergänzen falls nicht vorhanden.)

- [ ] **Step 3: Build verifizieren**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx vite build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && git add src/App.jsx src/components/Navigation.jsx && git commit -m "$(cat <<'EOF'
ui: Route /chronik + Navigation-Link

Neue Subseite ist über die Hauptnavigation erreichbar zwischen
Welt und Dashboard.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Deploy + visuelle Verifikation

**Files:** keine Code-Änderungen, nur Deploy + Browser-Test.

- [ ] **Step 1: Frontend deployen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && npx netlify deploy --prod --dir=dist
```

Erwartet: Production URL ausgegeben.

- [ ] **Step 2: /welt im Browser prüfen**

Öffne https://earth-01.netlify.app/welt . Mit eingeloggtem User der eine Dynasty hat:
- CharacterHUD oben erscheint, zeigt Emoji, Name, Generation, Energie, Restzeit-Balken, Familie, Erfolge
- Auf der Karte hat der Hauptchar einen pulsierenden goldenen Glow
- Familienmitglieder haben einen goldenen Rand
- Andere Agenten zeigen ein Rollen-Emoji
- FamilyTicker unter der Karte listet die letzten 5 Familie-Events

Wenn dein User noch keine Dynasty hat: gehe auf `/konfigurator`, gründe eine, lege einen Agenten an, kehre zu /welt zurück.

- [ ] **Step 3: /chronik im Browser prüfen**

Öffne https://earth-01.netlify.app/chronik .
- Vier Tabs sind oben sichtbar
- Stammbaum-Tab zeigt Agenten gruppiert nach Generation, Hauptchar mit goldenem Highlight
- Chronik-Tab listet Events
- Erfolge-Tab zeigt das AchievementGrid (gleich wie auf Dashboard)
- Tools-Tab zeigt freigeschaltete und gesperrte Tools mit Beispielen

- [ ] **Step 4: Death-Modal-Test**

Künstlich einen Tod des Hauptchars auslösen, um das Modal zu sehen:

```bash
cd /Users/matthiasduhrkop/Documents/earth-01 && SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> npx supabase db query "UPDATE agents SET age = max_age - 1 WHERE id = (SELECT main_agent_id FROM profiles WHERE id = '<deine-user-id>')" --linked
curl -s -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/simulation-tick" -H "Authorization: Bearer sb_publishable_klpid-UwygcxTJLmGhvJPA_RYD3ylaq"
```

Im Browser auf /welt: nach ~10s sollte das DeathModal aufploppen mit Tod-Ursache und Erbe-Info (falls Erbe vorhanden) oder Klon-Info.

- [ ] **Step 5: Verifikations-Checkliste abhaken**

Working:
- [ ] CharacterHUD rendert mit allen 4 Stats + Restzeit-Balken
- [ ] WorldCanvas: Hauptchar-Glow pulsiert, Familie hat Rand, Emoji auf jedem Agent
- [ ] FamilyTicker zeigt Familie-Events
- [ ] DeathModal poppt bei Tod auf (Erbe oder Klon-Variante)
- [ ] /chronik mit 4 Tabs erreichbar via Navigation
- [ ] Stammbaum-Tab gruppiert nach Generation
- [ ] Chronik-Tab zeigt Events mit Datum/Tick
- [ ] Tools-Tab zeigt korrekte builtin/extended Badges

Falls etwas nicht funktioniert: GitHub-Issue mit Repro-Schritten und Konsolen-Output eröffnen.

---

## Phase B — Abschluss

Nach Task 10:
- /welt ist visuell auf Layout B umgestellt
- Hauptcharakter ist in der UI klar als Star markiert
- Tod-Moment hat ein eigenes Modal
- Familienlinie hat ihre eigene Subseite mit 4 Tabs

**Nächster Schritt:** Phase C (Tool-Universum) — Edge Functions pro Tool, Tool-Dispatcher in telegram-webhook, Key-Setup-UI, Rate-Limiting. Separater Plan.
