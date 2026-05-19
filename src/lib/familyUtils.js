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
  const g = agent.gender === 'm' ? 'm' : 'f'
  return ROLE_EMOJI[role][g]
}

// For the main agent we always show the dynasty emoji instead of the role emoji.
export function emojiForMainAgent(dynastyEmoji) {
  return dynastyEmoji || '👑'
}
