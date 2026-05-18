import { queryLLM, loadLLMSettings } from './llmAdapters'

const VALID_ACTIONS = ['move', 'eat', 'drink', 'build', 'share', 'socialize', 'explore', 'rest', 'arrest', 'farm']

const SEASON_DE = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' }
const PHASE_DE = { work: 'Arbeit', free: 'Freizeit', sleep: 'Schlaf' }

function describeNearby(agent, agents, tiles, gridSize) {
  const lines = []
  const radius = 3

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = agent.x + dx
      const ny = agent.y + dy
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue
      const tile = tiles[ny * gridSize + nx]
      if (tile === 'f') lines.push(`  Nahrung bei (${nx},${ny})`)
      else if (tile === 'w') lines.push(`  Wasser bei (${nx},${ny})`)
      else if (tile === 'd') lines.push(`  Gefahr bei (${nx},${ny})`)
      else if (tile === 'b') lines.push(`  Gebäude bei (${nx},${ny})`)
      else if (tile === 's') lines.push(`  Unterschlupf bei (${nx},${ny})`)
      else if (tile === 'F') lines.push(`  Farm bei (${nx},${ny})`)
      else if (tile === 'r') lines.push(`  Straße bei (${nx},${ny})`)
    }
  }

  const nearby = agents.filter(
    (a) => a.id !== agent.id && a.alive && Math.abs(a.x - agent.x) <= radius && Math.abs(a.y - agent.y) <= radius
  )
  for (const a of nearby) {
    lines.push(`  Agent "${a.name}" bei (${a.x},${a.y}), Energie ${Math.round(a.energy)}, Rep ${a.reputation.toFixed(2)}`)
  }

  return lines.length > 0 ? lines.join('\n') : '  Nichts Besonderes in der Nähe.'
}

function buildPrompt(agent, worldState, agents, tiles) {
  const gridSize = worldState.grid_size ?? 30
  const season = SEASON_DE[worldState.season] ?? worldState.season
  const phase = PHASE_DE[worldState.day_phase] ?? worldState.day_phase

  const personality = Object.entries(agent.personality || {})
    .map(([k, v]) => `  ${k}: ${Number(v).toFixed(2)}`)
    .join('\n')

  const nearby = describeNearby(agent, agents, tiles, gridSize)

  return `Du bist "${agent.name}", ein Agent in einer simulierten Welt.

DEIN ZUSTAND:
  Position: (${agent.x}, ${agent.y})
  Energie: ${Math.round(agent.energy)}/100
  Alter: ${agent.age}/${agent.max_age}
  Reputation: ${agent.reputation.toFixed(2)}
  Generation: ${agent.generation}

DEINE PERSÖNLICHKEIT:
${personality}

WELT:
  Tick: ${worldState.tick}, Tag ${Math.floor(worldState.tick / 240)}
  Jahreszeit: ${season}
  Tagesphase: ${phase}
  Gittergröße: ${gridSize}x${gridSize}

UMGEBUNG (Radius 3):
${nearby}

REGELN:
- Wer nicht isst, verhungert (Energie sinkt stetig)
- Tod ist permanent
- Nahrung ("eat") gibt +15 Energie (nur auf Nahrung-Tiles)
- Wasser ("drink") gibt +5 Energie
- "socialize" erhöht Reputation (braucht Agent in der Nähe)
- "share" teilt Energie mit hungrigem Nachbar-Agent
- "build" erstellt Gebäude (kostet 25 Energie, nur auf leeren Tiles)
- "build" mit type: "s" baut Unterschlupf (20 Energie, schützt vor Winter)
- "build" mit type: "F" baut Farm (30 Energie, spawnt Nahrung in der Nähe)
- "build" mit type: "r" baut Straße (10 Energie, schnellere Bewegung)
- "arrest" verhaftet Agent mit negativer Reputation (braucht Nähe + Zeugen)
- "rest" regeneriert leicht
- "move" bewegt dich (gib direction an: north/south/east/west)
- "explore" bewegt dich zufällig

ERLAUBTE AKTIONEN: ${VALID_ACTIONS.join(', ')}

Antworte NUR mit einem JSON-Objekt. Beispiele:
{"action":"eat"}
{"action":"move","direction":"north"}
{"action":"socialize"}
{"action":"share"}

Was tust du als nächstes?`
}

function parseResponse(text) {
  const jsonMatch = text.match(/\{[^}]+\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.action || !VALID_ACTIONS.includes(parsed.action)) return null
    return parsed
  } catch {
    return null
  }
}

export async function getAgentDecision(agent, worldState, agents, tiles) {
  const settings = loadLLMSettings()
  if (!settings) return null

  const prompt = buildPrompt(agent, worldState, agents, tiles)

  try {
    const response = await queryLLM(prompt, settings)
    const decision = parseResponse(response)
    return decision
  } catch (err) {
    console.warn(`LLM-Entscheidung für ${agent.name} fehlgeschlagen:`, err.message)
    return null
  }
}

export function buildChatPrompt(agent, messages, memories, worldState) {
  const p = agent.personality || {}

  const memoryText = memories.length > 0
    ? memories.map(m => `- ${m.content}`).join('\n')
    : 'Keine Langzeit-Erinnerungen.'

  const chatHistory = messages
    .map(m => `${m.direction === 'user' ? 'User' : agent.name}: ${m.content}`)
    .join('\n')

  const season = SEASON_DE[worldState?.season] ?? (worldState?.season ?? 'unbekannt')
  const day = Math.floor((worldState?.tick ?? 0) / 240)

  return `Du bist "${agent.name}", ein Agent in der Welt Earth 0.1.
Generation ${agent.generation}, Alter ${agent.age} Ticks, Reputation ${(agent.reputation ?? 0).toFixed(2)}.

Deine Persönlichkeit:
- Kooperation: ${(p.cooperation ?? 0.5).toFixed(1)} (0=egoistisch, 1=hilfsbereit)
- Neugier: ${(p.curiosity ?? 0.5).toFixed(1)} (0=fokussiert, 1=neugierig)
- Risikobereitschaft: ${(p.risk_tolerance ?? 0.5).toFixed(1)} (0=vorsichtig, 1=mutig)
- Sozialverhalten: ${(p.social_mode ?? 0.5).toFixed(1)} (0=einzelgänger, 1=gesellig)

Dein aktueller Zustand:
- Energie: ${Math.round(agent.energy)}/100
- Position: (${agent.x}, ${agent.y})
- Saison: ${season}, Tag ${day}

Erinnerungen:
${memoryText}

Bisheriger Chat:
${chatHistory}

Antworte kurz (1-3 Sätze), freundlich und in character.
Du bist kein generischer Chatbot — du bist ein Wesen mit Erfahrungen aus der Simulation. Beziehe dich auf dein Leben wenn es passt. Antworte auf Deutsch.`
}

export { buildPrompt, parseResponse }
