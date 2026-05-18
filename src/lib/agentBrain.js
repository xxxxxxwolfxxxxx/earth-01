import { queryLLM, loadLLMSettings } from './llmAdapters'

const VALID_ACTIONS = ['move', 'eat', 'drink', 'build', 'share', 'socialize', 'explore', 'rest', 'arrest']

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
- "build" erstellt Gebäude (kostet Energie)
- "arrest" verhaftet Agent mit negativer Reputation (braucht Nähe)
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

export { buildPrompt, parseResponse }
