// Shared Dynasty-Logik für simulation-tick.
// Pure Funktionen wo möglich. Supabase-Client-Aufrufe in Wrappern.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const BASE_MAX_AGE = 2400;
export const ACHIEVEMENT_BONUS_TICKS = 800;

export interface AgentRow {
  id: string;
  owner_id: string | null;
  parent_a_id: string | null;
  parent_b_id: string | null;
  generation: number;
  alive: boolean;
  energy: number;
  age: number;
  max_age: number;
  reputation: number;
  personality: Record<string, number>;
  x: number;
  y: number;
  gender: "m" | "f" | null;
  display_name: string | null;
}

export interface ProfileRow {
  id: string;
  main_agent_id: string | null;
  dynasty_name: string | null;
  dynasty_emoji: string | null;
  dynasty_generation: number;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
}

export function computeMaxAge(achievementCount: number, rand: () => number = Math.random): number {
  const jitter = Math.floor((rand() - 0.5) * 400); // ±200 ticks
  return BASE_MAX_AGE + achievementCount * ACHIEVEMENT_BONUS_TICKS + jitter;
}

export function scoreCandidate(agent: AgentRow): number {
  const repPart = Math.max(0, agent.reputation) * 0.5;
  const energyPart = (Math.max(0, agent.energy) / 100) * 0.3;
  const agePart = Math.min(1, agent.age / Math.max(1, agent.max_age)) * 0.2;
  return repPart + energyPart + agePart;
}

// Liefert den besten lebenden Nachfahren des verstorbenen Agenten,
// rekursiv durch alle Generationen. allAgents MUSS lebende UND tote
// Agenten enthalten — wir traversieren den Stammbaum durch tote
// Vorfahren, um lebende Enkel/Urenkel zu erreichen.
export function findHeir(
  deadAgentId: string,
  allAgents: AgentRow[],
): AgentRow | null {
  // BFS durch alle Agenten (lebend + tot), um Descendants-Set zu bauen
  const descendants = new Set<string>([deadAgentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of allAgents) {
      if (descendants.has(a.id)) continue;
      if (
        (a.parent_a_id && descendants.has(a.parent_a_id)) ||
        (a.parent_b_id && descendants.has(a.parent_b_id))
      ) {
        descendants.add(a.id);
        changed = true;
      }
    }
  }
  descendants.delete(deadAgentId);

  // Nur lebende Nachfahren als Kandidaten
  const livingDescendants = allAgents.filter(
    (a) => a.alive && descendants.has(a.id),
  );
  if (livingDescendants.length === 0) return null;

  // Direkte lebende Kinder bevorzugen, sonst gesamter lebender Pool
  const livingChildren = livingDescendants.filter(
    (a) => a.parent_a_id === deadAgentId || a.parent_b_id === deadAgentId,
  );
  const pool = livingChildren.length > 0 ? livingChildren : livingDescendants;

  let best = pool[0];
  let bestScore = scoreCandidate(best);
  for (let i = 1; i < pool.length; i++) {
    const s = scoreCandidate(pool[i]);
    if (s > bestScore) {
      best = pool[i];
      bestScore = s;
    }
  }
  return best;
}

// Kontext für die Condition-Evaluierung.
export interface ConditionContext {
  agent: AgentRow;
  achievementCount: number;
  techResearched: Set<string>;       // alle erforschten tech_id Strings
  alliancesFoundedByAgent: number;
  alliancesDistinct: number;
  descendantsAlive: number;
  killsByAgent: number;
  buildingsByAgent: Map<string, number>; // tile_type → count
}

export function evaluateCondition(
  condition: Record<string, unknown>,
  ctx: ConditionContext,
): boolean {
  const type = condition.type as string;
  switch (type) {
    case "tech_researched":
      return ctx.techResearched.has(condition.tech as string);
    case "action_count": {
      const action = condition.action as string;
      const min = condition.min as number;
      if (action === "eat") return (ctx.agent as any).eat_count >= min;
      if (action === "drink") return (ctx.agent as any).drink_count >= min;
      return false;
    }
    case "tiles_visited":
      return Array.isArray((ctx.agent as any).tiles_visited) &&
        (ctx.agent as any).tiles_visited.length >= (condition.min as number);
    case "alliance_founded":
      return ctx.alliancesFoundedByAgent >= (condition.min as number);
    case "alliances_distinct":
      return ctx.alliancesDistinct >= (condition.min as number);
    case "tile_built": {
      const tileType = condition.tile_type as string;
      const min = condition.min as number;
      return (ctx.buildingsByAgent.get(tileType) ?? 0) >= min;
    }
    case "trades_completed":
      return (ctx.agent as any).trades_completed >= (condition.min as number);
    case "kills":
      return ctx.killsByAgent >= (condition.min as number);
    case "generation_reached":
      return ctx.agent.generation >= (condition.min as number);
    case "descendants_alive":
      return ctx.descendantsAlive >= (condition.min as number);
    case "achievement_count":
      return ctx.achievementCount >= (condition.min as number);
    case "all_techs_researched":
      return ctx.techResearched.size >= 12;
    default:
      return false;
  }
}

// Baut die Felder für einen Klon-Spawn basierend auf dem verstorbenen Agenten.
// Personality-Mutation ±0.1 pro Slider, Position = letzte Position,
// neue ID + Gen 0.
export interface CloneSpec {
  owner_id: string;
  name: string;
  display_name: string;
  personality: Record<string, number>;
  x: number;
  y: number;
  energy: number;
  max_age: number;
  generation: number;
  gender: "m" | "f";
  parent_a_id: null;
  parent_b_id: null;
}

export function buildClone(
  dead: AgentRow,
  newMaxAge: number,
  dynastyName: string,
  rand: () => number = Math.random,
): CloneSpec {
  const mutated: Record<string, number> = {};
  for (const k of Object.keys(dead.personality)) {
    const delta = (rand() - 0.5) * 0.2;
    mutated[k] = Math.max(0, Math.min(1, dead.personality[k] + delta));
  }
  return {
    owner_id: dead.owner_id!,
    name: dynastyName,
    display_name: `${dynastyName} 01`,
    personality: mutated,
    x: dead.x,
    y: dead.y,
    energy: 60,
    max_age: newMaxAge,
    generation: 0,
    gender: rand() < 0.5 ? "m" : "f",
    parent_a_id: null,
    parent_b_id: null,
  };
}
