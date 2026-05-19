import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage, targetFromProfile } from "../_shared/telegram.ts";
import {
  AgentRow as DAgentRow,
  ProfileRow as DProfileRow,
  computeMaxAge,
  findHeir,
  evaluateCondition,
  buildClone,
  ConditionContext,
} from "../_shared/dynasty.ts";

// ═══════════════════════════════════════════════════════════════════
// EARTH 0.1 SIMULATION ENGINE — Freeciv-inspired
// ═══════════════════════════════════════════════════════════════════

const TICKS_PER_CALL = 10;
const TICK_DELAY_MS = 6000;
const DAY_LENGTH = 240;
const SEASON_LENGTH = 80;
const FOOD_SPAWN_INTERVAL = 5;
const DISASTER_INTERVAL = 40;
const MAX_POPULATION = 60;
const FARM_SPAWN_RADIUS = 2;
const FARM_SPAWN_CHANCE = 0.15;

// ─── Land Mask (60x60) — hand-traced Earth continents ─────────────
// Layout: Row 0 Arctic, Rows 1-2 Arctic ocean, Rows 3-40 continents,
//         Rows 41-48 ocean, Rows 49-53 Antarctica, Rows 54-59 southern ocean
const LAND_MASK = [
  // Row 0: Arctic ice cap
  "oooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooo",
  // Rows 1-2: Arctic ocean buffer
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  // Rows 3-40: Continents (shifted down 2 rows)
  "oLLLooooooooooLLLLooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "oLLLLoLLLLooooLLLLLoooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooo",
  "oLLLLLLLLLLLooLLLLLoooLLoLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoo",
  "ooLLLLLLLLLLLoLLLLoooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoo",
  "ooooLLLLLLLLLooLLLoooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooo",
  "ooooLLLLLLLLLooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "ooooLLLLLLLLoooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "ooooLLLLLLLLooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooo",
  "ooooLLLLLLLLooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooo",
  "oooooLLLLLLLooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooo",
  "oooooLLLLLLooooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "oooooLLLLLLoooooooooooooLLLLLoLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "ooooooLLLLLLooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooooo",
  "ooooooLLLLoLLoooooooooooLLLLLLLLLLLLLLLLLLLLooLLLLLLoooooooo",
  "oooooooLLLooooooooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLooooooooo",
  "oooooooLLoooooooooooooooLLLLLLLLLLLLooooLLLLLLLLLLLLLooooooo",
  "oooooooLLoooooooooooooooLLLLLLLLLLLLooooLLLoLLLLLLoLLooooooo",
  "ooooooooLLoooooooooooooooLLLLLLLLLLLoooooLLoLLLLLooLLooooooo",
  "ooooooooLLLLLLooooooooooooLLLLLLLLLLooooooLoLLLLLLLLoooooooo",
  "ooooooooooLLLLLoooooooooooLLLLLLLLLLoooooooooLLLoLLLoooooooo",
  "ooooooooooLLLLLLoooooooooooLLLLLLLLoooooooooLLLLoLLLLoLLLooo",
  "ooooooooooLLLLLLLooooooooooLLLLLLLLoooooooooLLLLLooLLoLLLLoo",
  "ooooooooooLLLLLLLLoooooooooLLLLLLLLooooooooooooooooooooLLLoo",
  "oooooooooooLLLLLLLooooooooooLLLLLLLooooooooooooooooooooooooo",
  "oooooooooooLLLLLLLooooooooooLLLLLLLooooooooooooooooooooooooo",
  "oooooooooooLLLLLLooooooooooooLLLLLLooooooooooooooLLLLLLLoooo",
  "ooooooooooooLLLLLooooooooooooLLLLLoLoooooooooooooLLLLLLLLooo",
  "ooooooooooooLLLLLoooooooooooooLLLLoLLoooooooooooLLLLLLLLLooo",
  "oooooooooooooLLLooooooooooooooLLLLoLLoooooooooooLLLLLLLLLooo",
  "oooooooooooooLLLoooooooooooooooLLLoLooooooooooooLLLLLLLLLooo",
  "oooooooooooooLLLoooooooooooooooLLLoooooooooooooooLLLLLLLLooo",
  "ooooooooooooooLLoooooooooooooooLLooooooooooooooooLLLLLLLoooo",
  "ooooooooooooooLLooooooooooooooooooooooooooooooooooLLLLLLoLoo",
  "ooooooooooooooLLooooooooooooooooooooooooooooooooooLLLLLLoLLo",
  "ooooooooooooooLLoooooooooooooooooooooooooooooooooooLLLLooLLo",
  "ooooooooooooooLoooooooooooooooooooooooooooooooooooooooooooLo",
  "ooooooooooooooLooooooooooooooooooooooooooooooooooooooooooooo",
  "ooooooooooooooLooooooooooooooooooooooooooooooooooooooooooooo",
  // Rows 41-48: Ocean gap (8 rows, reduced from 16)
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  // Rows 49-53: Antarctica (moved up from rows 55-59)
  "ooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooooooo",
  "ooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooooo",
  "ooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooo",
  "oooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLoooo",
  "ooooooooLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLooooooo",
  // Rows 54-59: Southern ocean
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
];
const LAND_MASK_FIXED = LAND_MASK.map(row => row.length < 60 ? row + "o".repeat(60 - row.length) : row.slice(0, 60));

function isLand(x: number, y: number): boolean {
  if (y < 0 || y >= 60 || x < 0 || x >= 60) return false;
  return LAND_MASK_FIXED[y][x] === "L";
}

// ─── Terrain Yields (Freeciv-inspired) ─────────────────────────────
// Each tile type produces food, materials, knowledge per tick
interface TileYield { food: number; materials: number; knowledge: number }

const TILE_YIELDS: Record<string, TileYield> = {
  e: { food: 0.0, materials: 0.0, knowledge: 0.0 },   // empty land
  f: { food: 1.5, materials: 0.0, knowledge: 0.0 },   // food
  w: { food: 0.3, materials: 0.0, knowledge: 0.1 },   // water
  d: { food: 0.0, materials: 0.0, knowledge: 0.0 },   // danger
  b: { food: 0.0, materials: 0.5, knowledge: 0.2 },   // building
  s: { food: 0.0, materials: 0.3, knowledge: 0.0 },   // shelter
  F: { food: 0.8, materials: 0.2, knowledge: 0.0 },   // farm
  r: { food: 0.0, materials: 0.1, knowledge: 0.1 },   // road
  P: { food: 0.2, materials: 0.5, knowledge: 0.3 },   // port
  A: { food: 0.0, materials: 0.0, knowledge: 0.0 },   // wild animal (hunted for food)
  o: { food: 0.0, materials: 0.0, knowledge: 0.0 },   // ocean
};

// Season multipliers for yields
const SEASON_YIELD_MULT: Record<string, { food: number; materials: number }> = {
  spring: { food: 1.2, materials: 1.0 },
  summer: { food: 1.5, materials: 1.0 },
  autumn: { food: 0.8, materials: 1.2 },
  winter: { food: 0.3, materials: 0.8 },
};

// ─── Agent Roles (Freeciv unit types adapted) ──────────────────────
interface RoleBonus {
  label: string;
  foodMult: number;
  materialsMult: number;
  knowledgeMult: number;
  attackMult: number;
  defenseMult: number;
  buildCostMult: number;
}

const ROLES: Record<string, RoleBonus> = {
  generalist: { label: "Generalist", foodMult: 1.0, materialsMult: 1.0, knowledgeMult: 1.0, attackMult: 1.0, defenseMult: 1.0, buildCostMult: 1.0 },
  farmer:     { label: "Bauer",      foodMult: 2.0, materialsMult: 0.5, knowledgeMult: 0.5, attackMult: 0.7, defenseMult: 0.8, buildCostMult: 1.2 },
  builder:    { label: "Baumeister", foodMult: 0.5, materialsMult: 2.0, knowledgeMult: 0.5, attackMult: 0.7, defenseMult: 1.0, buildCostMult: 0.6 },
  researcher: { label: "Forscher",   foodMult: 0.5, materialsMult: 0.5, knowledgeMult: 2.5, attackMult: 0.5, defenseMult: 0.7, buildCostMult: 1.0 },
  guard:      { label: "Wächter",    foodMult: 0.5, materialsMult: 0.5, knowledgeMult: 0.3, attackMult: 2.0, defenseMult: 2.0, buildCostMult: 1.5 },
  trader:     { label: "Händler",    foodMult: 0.8, materialsMult: 0.8, knowledgeMult: 0.8, attackMult: 0.5, defenseMult: 0.5, buildCostMult: 1.0 },
};

// Assign role based on personality (auto-specialization)
function assignRole(p: Record<string, number>, age: number): string {
  if (age < 100) return "generalist"; // Young agents don't specialize yet
  if (p.cooperation > 0.7 && p.priority > 0.6) return "farmer";
  if (p.priority > 0.7 && p.cooperation > 0.4) return "builder";
  if (p.curiosity > 0.7) return "researcher";
  if (p.risk_tolerance > 0.7 && p.cooperation < 0.4) return "guard";
  if (p.social_mode > 0.7 && p.cooperation > 0.5) return "trader";
  return "generalist";
}

// ─── Tech Tree (Freeciv-inspired) ──────────────────────────────────
interface Tech {
  name: string;
  label: string;
  cost: number;            // knowledge points needed
  requires: string[];      // prerequisite tech names
  effect: string;          // description
}

const TECH_TREE: Tech[] = [
  // Tier 1 — no prerequisites
  { name: "agriculture", label: "Landwirtschaft", cost: 50, requires: [], effect: "Farmen produzieren +50% Food" },
  { name: "masonry", label: "Mauerwerk", cost: 50, requires: [], effect: "Gebäude geben +1.0 Defense" },
  { name: "toolmaking", label: "Werkzeugbau", cost: 40, requires: [], effect: "Bau kostet -20% Materials" },
  // Tier 2
  { name: "irrigation", label: "Bewässerung", cost: 80, requires: ["agriculture"], effect: "Farmen Spawn-Radius +1" },
  { name: "fortification", label: "Befestigung", cost: 80, requires: ["masonry"], effect: "Shelter gibt +2.0 Defense" },
  { name: "writing", label: "Schrift", cost: 60, requires: ["toolmaking"], effect: "Lehren gibt +50% Knowledge" },
  // Tier 3
  { name: "medicine", label: "Medizin", cost: 120, requires: ["agriculture", "writing"], effect: "Schlaf regeneriert +0.3/Tick extra" },
  { name: "navigation", label: "Navigation", cost: 100, requires: ["masonry", "toolmaking"], effect: "Häfen erlauben 12-Felder Überfahrt (statt 8)" },
  { name: "trade_routes", label: "Handelsrouten", cost: 100, requires: ["writing", "toolmaking"], effect: "Handel gibt +3 statt +2 Materials" },
  // Tier 4
  { name: "philosophy", label: "Philosophie", cost: 150, requires: ["writing", "medicine"], effect: "Forscher produzieren +100% Knowledge" },
  { name: "engineering", label: "Ingenieurwesen", cost: 150, requires: ["fortification", "navigation"], effect: "Neue Tile-Typen: Brücke, Aquädukt" },
  // Tier 5
  { name: "democracy", label: "Demokratie", cost: 200, requires: ["philosophy", "trade_routes"], effect: "Allianzen mit 'Demokratie' Regierung möglich, +Reputation für alle" },
];

function isTechResearched(researched: string[], name: string): boolean {
  return researched.includes(name);
}

function canResearch(researched: string[], tech: Tech): boolean {
  if (researched.includes(tech.name)) return false;
  return tech.requires.every(r => researched.includes(r));
}

function getNextResearch(researched: string[]): Tech | null {
  for (const tech of TECH_TREE) {
    if (canResearch(researched, tech)) return tech;
  }
  return null;
}

// ─── Combat System (Freeciv-inspired) ──────────────────────────────
interface CombatResult {
  attackerWins: boolean;
  damageToLoser: number;
  veteranGained: boolean;
}

function resolveCombat(
  attackerAtk: number, attackerDef: number,
  defenderAtk: number, defenderDef: number,
  terrainDefBonus: number, defenderInShelter: boolean,
  attackerVeteran: boolean, defenderVeteran: boolean
): CombatResult {
  let effAtk = attackerAtk * (attackerVeteran ? 1.5 : 1.0);
  let effDef = defenderDef * (defenderVeteran ? 1.5 : 1.0) * terrainDefBonus * (defenderInShelter ? 2.0 : 1.0);

  // Probabilistic: attacker wins with probability effAtk / (effAtk + effDef)
  const attackerWinChance = effAtk / (effAtk + effDef);
  const attackerWins = Math.random() < attackerWinChance;

  const baseDamage = 15 + Math.random() * 10;
  const veteranGained = Math.random() < 0.3; // 30% chance to gain veteran status

  return { attackerWins, damageToLoser: baseDamage, veteranGained };
}

// Terrain defense bonus
function getTerrainDefenseBonus(tileType: string): number {
  switch (tileType) {
    case "b": return 1.5;  // building
    case "s": return 2.0;  // shelter
    case "F": return 1.0;  // farm (open field)
    case "r": return 0.8;  // road (exposed)
    case "d": return 0.5;  // danger zone
    default: return 1.0;
  }
}

// ─── Hex Math ──────────────────────────────────────────────────────
const HEX_EVEN: [number, number][] = [[-1,-1],[0,-1],[-1,0],[1,0],[-1,1],[0,1]];
const HEX_ODD:  [number, number][] = [[0,-1],[1,-1],[-1,0],[1,0],[0,1],[1,1]];

function hexNeighbors(x: number, y: number, gridSize: number): [number, number][] {
  const offsets = y % 2 === 0 ? HEX_EVEN : HEX_ODD;
  return offsets
    .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize);
}

function offsetToCube(col: number, row: number): [number, number, number] {
  const q = col - Math.floor((row - (row & 1)) / 2);
  const r = row;
  return [q, r, -q - r];
}

function hexDistance(col1: number, row1: number, col2: number, row2: number): number {
  const [q1, r1, s1] = offsetToCube(col1, row1);
  const [q2, r2, s2] = offsetToCube(col2, row2);
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
}

function hexCellsInRadius(col: number, row: number, radius: number, gridSize: number): [number, number][] {
  const [cq, cr] = offsetToCube(col, row);
  const cells: [number, number][] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const q = cq + dq;
      const r = cr + dr;
      const c = q + Math.floor((r - (r & 1)) / 2);
      if (c >= 0 && r >= 0 && c < gridSize && r < gridSize) {
        cells.push([c, r]);
      }
    }
  }
  return cells;
}

function landNeighbors(x: number, y: number, gridSize: number): [number, number][] {
  return hexNeighbors(x, y, gridSize).filter(([nx, ny]) => isLand(nx, ny));
}

function tileIdx(x: number, y: number, gridSize: number): number {
  return y * gridSize + x;
}

// ─── Types ─────────────────────────────────────────────────────────
type Agent = {
  id: string; name: string; x: number; y: number;
  energy: number; materials: number; knowledge: number;
  age: number; max_age: number; alive: boolean;
  day_phase: string; personality: Record<string, number>;
  reputation: number; imprisoned_until: number | null;
  pending_suggestion: Record<string, unknown> | null;
  generation: number; parent_a_id: string | null; parent_b_id: string | null;
  owner_id: string; role: string;
  attack: number; defense: number; veteran: boolean; kills: number;
  alliance_id: string | null;
  schedule_mode: string; work_ticks: number; free_ticks: number; sleep_ticks: number;
  cycle_start_tick: number; forced_phase: string | null;
  // Quest/progression fields
  abilities: string[];
  completed_quests: string[];
  move_target_x: number | null;
  move_target_y: number | null;
  total_food_collected: number;
  has_met_other: boolean;
  has_built: boolean;
  hunts: number;
};

const SEASONS = ["spring", "summer", "autumn", "winter"];
const CHILD_NAMES = [
  "Aria","Bolt","Cora","Dex","Elia","Finn","Gaia","Hex","Iris","Juno",
  "Kai","Luna","Milo","Nova","Onyx","Pax","Quill","Rex","Sol","Tara",
  "Uma","Vex","Wren","Xara","Yuki","Zara","Aero","Blaze","Cyra","Dusk",
  "Echo","Flux","Glyph","Haze","Ion","Jett","Kira","Lux","Moss","Nyx",
];

const BUILD_COSTS: Record<string, { energy: number; materials: number; from: string[] }> = {
  s: { energy: 15, materials: 10, from: ["e"] },
  b: { energy: 20, materials: 15, from: ["e"] },
  r: { energy: 8, materials: 5, from: ["e"] },
  F: { energy: 20, materials: 10, from: ["e", "f"] },
  P: { energy: 30, materials: 25, from: ["e"] },
};

// ─── Quest Definitions (mirrored from frontend questDefinitions.js) ──
const QUEST_CHECKS: { id: string; type: string; check: (a: Agent) => boolean; unlocks: string[] }[] = [
  { id: "survive_10", type: "agent", check: (a) => (a.age ?? 0) >= 10, unlocks: ["move_far"] },
  { id: "collect_food_20", type: "agent", check: (a) => (a.total_food_collected ?? 0) >= 20, unlocks: ["build"] },
  { id: "meet_other", type: "agent", check: (a) => a.has_met_other === true, unlocks: ["trade", "socialize"] },
  { id: "build_first", type: "agent", check: (a) => a.has_built === true, unlocks: ["alliance"] },
  { id: "collect_knowledge_30", type: "agent", check: (a) => (a.knowledge ?? 0) >= 30, unlocks: ["research"] },
  { id: "first_hunt", type: "agent", check: (a) => (a.hunts ?? 0) >= 3, unlocks: ["hunting"] },
];

const QUEST_REQUIRES: Record<string, string[]> = {
  build_first: ["collect_food_20"],
};

function checkAndGrantQuests(agent: Agent, profile?: { llm_api_key?: string; telegram_bot_token?: string } | null): string[] {
  const completed = agent.completed_quests ?? [];
  const abilities = agent.abilities ?? ["move", "eat"];
  const newlyCompleted: string[] = [];

  // User quests (checked via profile)
  if (profile) {
    if (!completed.includes("setup_llm") && profile.llm_api_key) {
      completed.push("setup_llm"); newlyCompleted.push("setup_llm");
      if (!abilities.includes("think")) abilities.push("think");
    }
    if (!completed.includes("setup_telegram") && profile.telegram_bot_token) {
      completed.push("setup_telegram"); newlyCompleted.push("setup_telegram");
      if (!abilities.includes("telegram")) abilities.push("telegram");
    }
  }

  // Agent quests
  for (const quest of QUEST_CHECKS) {
    if (completed.includes(quest.id)) continue;
    const reqs = QUEST_REQUIRES[quest.id];
    if (reqs && !reqs.every(r => completed.includes(r))) continue;
    if (quest.check(agent)) {
      completed.push(quest.id);
      newlyCompleted.push(quest.id);
      for (const ability of quest.unlocks) {
        if (!abilities.includes(ability)) abilities.push(ability);
      }
    }
  }

  agent.completed_quests = completed;
  agent.abilities = abilities;
  return newlyCompleted;
}

function hasAbility(agent: Agent, ability: string): boolean {
  return (agent.abilities ?? ["move", "eat"]).includes(ability);
}

// ─── Move Target Processing ──────────────────────────────────────
function moveTowardTarget(agent: Agent, gridSize: number): boolean {
  if (agent.move_target_x == null || agent.move_target_y == null) return false;
  const tx = agent.move_target_x;
  const ty = agent.move_target_y;
  if (agent.x === tx && agent.y === ty) {
    agent.move_target_x = null;
    agent.move_target_y = null;
    return false;
  }
  // Find hex neighbor closest to target
  const neighbors = landNeighbors(agent.x, agent.y, gridSize);
  if (neighbors.length === 0) return false;
  let bestDist = hexDistance(agent.x, agent.y, tx, ty);
  let bestPos: [number, number] | null = null;
  for (const [nx, ny] of neighbors) {
    const d = hexDistance(nx, ny, tx, ty);
    if (d < bestDist) { bestDist = d; bestPos = [nx, ny]; }
  }
  if (bestPos) {
    agent.x = bestPos[0];
    agent.y = bestPos[1];
    if (agent.x === tx && agent.y === ty) {
      agent.move_target_x = null;
      agent.move_target_y = null;
    }
    return true;
  }
  return false;
}

function getDayPhase(tick: number): string {
  const phase = tick % DAY_LENGTH;
  if (phase < 80) return "work";
  if (phase < 160) return "free";
  return "sleep";
}

function getAgentPhase(agent: Agent, tick: number): string {
  if (agent.forced_phase) return agent.forced_phase;
  if (agent.energy < 20 && agent.sleep_ticks < 80) return "sleep";
  const ticksInCycle = tick - agent.cycle_start_tick;
  const ticksRemaining = Math.max(0, DAY_LENGTH - ticksInCycle);
  if (agent.sleep_ticks < 80 && ticksRemaining <= (80 - agent.sleep_ticks)) return "sleep";
  if (agent.work_ticks >= 80 && agent.free_ticks >= 80 && agent.sleep_ticks >= 80) return "sleep";
  const priority = agent.personality.priority ?? 0.5;
  const social = agent.personality.social_mode ?? 0.5;
  if (agent.work_ticks < 80 && priority > 0.5) return "work";
  if (agent.free_ticks < 80 && social > 0.5) return "free";
  if (agent.work_ticks <= agent.free_ticks && agent.work_ticks < 80) return "work";
  if (agent.free_ticks < 80) return "free";
  if (agent.sleep_ticks < 80) return "sleep";
  return "work";
}

function getSeason(tick: number): string {
  return SEASONS[Math.floor((tick / SEASON_LENGTH) % 4)];
}

function energyCost(season: string, onShelter: boolean): number {
  const base = season === "winter" ? 0.4 : season === "autumn" ? 0.25 : 0.2;
  return onShelter && season === "winter" ? base * 0.5 : base;
}

function foodSpawnRate(season: string): number {
  switch (season) {
    case "spring": return 0.06; case "summer": return 0.08;
    case "autumn": return 0.04; case "winter": return 0.02;
    default: return 0.04;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACHIEVEMENT ENGINE
// ═══════════════════════════════════════════════════════════════════

async function processAchievementsForUsers(
  supabase: ReturnType<typeof createClient>,
  livingAgents: any[],
  worldTech: { researched: string[] },
  alliances: any[],
): Promise<void> {
  // 1. Hole alle Profile mit main_agent_id
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, telegram_bot_token, telegram_chat_id")
    .not("main_agent_id", "is", null);
  if (profErr || !profiles) return;

  // 2. Hole alle Achievements (Katalog) und alle freigeschalteten
  const { data: catalog } = await supabase.from("achievements").select("*");
  const { data: unlocked } = await supabase
    .from("dynasty_achievements")
    .select("user_id, achievement_id");
  if (!catalog || !unlocked) return;

  const unlockedByUser = new Map<string, Set<string>>();
  for (const row of unlocked) {
    if (!unlockedByUser.has(row.user_id)) unlockedByUser.set(row.user_id, new Set());
    unlockedByUser.get(row.user_id)!.add(row.achievement_id);
  }

  // 3. Pro Profile: für jeden noch-nicht-freigeschalteten Achievement prüfen
  const techSet = new Set(worldTech.researched ?? []);
  for (const profile of profiles) {
    const mainAgent = livingAgents.find((a) => a.id === profile.main_agent_id);
    if (!mainAgent) continue;
    const userUnlocked = unlockedByUser.get(profile.id) ?? new Set<string>();

    // Nachfahren-Zähler
    const descendants = countLivingDescendants(mainAgent.id, livingAgents);
    // Buildings-Counter aus dem agent-Feld
    const buildingsByAgent = new Map<string, number>();
    const myBuildings = (mainAgent as any).buildings_built ?? {};
    for (const k of Object.keys(myBuildings)) buildingsByAgent.set(k, myBuildings[k]);
    // Alliances
    const myAlliances = alliances.filter((a) =>
      a.member_ids?.includes(mainAgent.id) || a.founder_id === mainAgent.id
    );
    const founded = alliances.filter((a) => a.founder_id === mainAgent.id).length;
    const distinct = myAlliances.length;
    // Kills (existiert schon auf agent-Tabelle aus migration 006)
    const kills = (mainAgent as any).kills ?? 0;

    const ctx: ConditionContext = {
      agent: mainAgent as DAgentRow,
      achievementCount: userUnlocked.size,
      techResearched: techSet,
      alliancesFoundedByAgent: founded,
      alliancesDistinct: distinct,
      descendantsAlive: descendants,
      killsByAgent: kills,
      buildingsByAgent,
    };

    for (const ach of catalog) {
      if (userUnlocked.has(ach.id)) continue;
      if (!evaluateCondition(ach.unlock_condition as any, ctx)) continue;

      // Unlock!
      await supabase.from("dynasty_achievements").insert({
        user_id: profile.id,
        achievement_id: ach.id,
        unlocked_by_agent_id: mainAgent.id,
      });
      await supabase.from("world_events").insert({
        tick: (mainAgent as any).tick ?? 0,
        event_type: "achievement_unlocked",
        detail: {
          user_id: profile.id,
          agent_id: mainAgent.id,
          achievement_id: ach.id,
          achievement_name: ach.name,
          icon: ach.icon,
        },
      });
      // Telegram
      await sendTelegramMessage(targetFromProfile(profile as any),
        `${ach.icon} <b>${profile.dynasty_name}</b> hat <b>${ach.name}</b> freigeschaltet!\n\n${ach.description}\nTool <code>${ach.tool_id}</code> ist nun verfügbar.`
      );
      userUnlocked.add(ach.id);
    }
  }
}

function countLivingDescendants(rootId: string, agents: any[]): number {
  const set = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of agents) {
      if (!a.alive || set.has(a.id)) continue;
      if (
        (a.parent_a_id && set.has(a.parent_a_id)) ||
        (a.parent_b_id && set.has(a.parent_b_id))
      ) {
        set.add(a.id);
        changed = true;
      }
    }
  }
  set.delete(rootId);
  return set.size;
}

// ═══════════════════════════════════════════════════════════════════
// DYNASTY DEATH PROCESSING
// ═══════════════════════════════════════════════════════════════════

async function processDeaths(
  supabase: ReturnType<typeof createClient>,
  deadAgentIds: string[],
): Promise<void> {
  if (deadAgentIds.length === 0) return;
  // Hole alle relevanten profiles (Hauptchar verloren?) und alle lebenden Agents
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, telegram_bot_token, telegram_chat_id")
    .in("main_agent_id", deadAgentIds);
  if (!profiles || profiles.length === 0) return;
  // findHeir braucht lebende UND tote Agenten zur Stammbaum-Traversierung.
  // Wir filtern auf die owner_ids der betroffenen User, um Bound zu halten.
  const ownerIds = profiles.map((p) => p.id);
  const { data: ownerAgents } = await supabase
    .from("agents").select("*").in("owner_id", ownerIds);
  const allAgents = (ownerAgents ?? []) as DAgentRow[];
  const { data: deadAgents } = await supabase
    .from("agents").select("*").in("id", deadAgentIds);

  for (const profile of profiles) {
    const dead = deadAgents?.find((a) => a.id === profile.main_agent_id);
    if (!dead) continue;
    const cause = (dead as any).cause_of_death ?? "unknown";

    const heir = findHeir(dead.id, allAgents);
    if (heir) {
      // Erbe übernimmt
      const dynastyName = profile.dynasty_name ?? "Dynasty";
      const newGen = profile.dynasty_generation + 1;
      const newDisplayName = `${dynastyName} ${String(newGen).padStart(2,"0")}`;
      await supabase.from("agents").update({ display_name: newDisplayName })
        .eq("id", heir.id);
      await supabase.from("profiles").update({
        main_agent_id: heir.id,
        dynasty_generation: newGen,
      }).eq("id", profile.id);
      await supabase.from("world_events").insert({
        tick: (dead as any).age ?? 0,
        event_type: "dynasty_succession",
        detail: {
          user_id: profile.id,
          deceased_id: dead.id,
          deceased_display: (dead as any).display_name ?? dynastyName,
          cause,
          heir_id: heir.id,
          heir_display: newDisplayName,
          generation: newGen,
        },
      });
      await sendTelegramMessage(targetFromProfile(profile as any),
        `👑 <b>${(dead as any).display_name ?? dynastyName}</b> ist gestorben (${cause}).\n\nDie Linie wird fortgeführt von <b>${newDisplayName}</b> (Generation ${newGen}).`
      );
    } else {
      // Kinderlos → Klon
      const { count: achCount } = await supabase
        .from("dynasty_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      const newMaxAge = computeMaxAge(achCount ?? 0);
      const clone = buildClone(dead as DAgentRow, newMaxAge, profile.dynasty_name ?? "Dynasty");

      // Insert clone und main_agent neu setzen
      const { data: insertedClone } = await supabase
        .from("agents").insert(clone).select().single();
      if (insertedClone) {
        await supabase.from("profiles").update({
          main_agent_id: insertedClone.id,
          dynasty_generation: 1,
        }).eq("id", profile.id);
      }

      // Jüngstes Achievement strippen (höchstes unlocked_at)
      const { data: latest } = await supabase
        .from("dynasty_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", profile.id)
        .order("unlocked_at", { ascending: false })
        .limit(1);
      let lostName = "";
      if (latest && latest.length > 0) {
        const lostId = latest[0].achievement_id;
        const { data: lostAch } = await supabase
          .from("achievements").select("name, icon").eq("id", lostId).single();
        lostName = lostAch ? `${lostAch.icon} ${lostAch.name}` : lostId;
        await supabase.from("dynasty_achievements")
          .delete()
          .eq("user_id", profile.id).eq("achievement_id", lostId);
      }

      await supabase.from("world_events").insert({
        tick: (dead as any).age ?? 0,
        event_type: "dynasty_childless_restart",
        detail: {
          user_id: profile.id,
          deceased_id: dead.id,
          cause,
          lost_achievement: lostName,
          clone_id: insertedClone?.id ?? null,
        },
      });
      await sendTelegramMessage(targetFromProfile(profile as any),
        `💔 Familie <b>${profile.dynasty_name}</b> ist ausgestorben.\n\nEin Klon-Nachfolger versucht erneut. Verloren: ${lostName || "(noch nichts)"}.`
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SIMULATION LOOP
// ═══════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  if (url.searchParams.get("reset") === "true") {
    await supabase.from("agents").update({ alive: false, energy: 0, cause_of_death: "world_reset" }).eq("alive", true);
    return new Response(JSON.stringify({ ok: true, action: "reset" }));
  }

  for (let tickNum = 0; tickNum < TICKS_PER_CALL; tickNum++) {
    const { data: ws } = await supabase.from("world_state").select("*").single();
    if (!ws) break;

    const tick = ws.tick + 1;
    const gridSize = ws.grid_size;
    const season = getSeason(tick);
    const dayPhase = getDayPhase(tick);
    const seasonMult = SEASON_YIELD_MULT[season] ?? { food: 1.0, materials: 1.0 };

    const { data: tilesRow } = await supabase.from("world_tiles").select("tiles").single();
    let tiles = (tilesRow?.tiles ?? "").split("");

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!isLand(x, y)) tiles[tileIdx(x, y, gridSize)] = "o";
      }
    }

    // Load tech tree
    const { data: techData } = await supabase.from("world_tech").select("*").single();
    const researched: string[] = techData?.researched ?? [];
    let currentResearch = techData?.current_research ?? null;
    let researchPoints = techData?.research_points ?? 0;

    const { data: agentsData } = await supabase.from("agents").select("*").eq("alive", true);
    let agents: Agent[] = agentsData ?? [];

    // Auto-seed if empty
    if (agents.length === 0) {
      const SEED = [
        { cells:[[3,5],[4,5],[5,5],[4,6],[5,6]], names:["Eagle","River","Storm","Cedar","Hawk"], p:{priority:0.6,social_mode:0.5,risk_tolerance:0.7,curiosity:0.8,cooperation:0.5} },
        { cells:[[8,14],[9,14],[8,15],[9,15],[8,16]], names:["Sol","Luna","Rio","Flora","Tierra"], p:{priority:0.5,social_mode:0.7,risk_tolerance:0.5,curiosity:0.6,cooperation:0.7} },
        { cells:[[14,4],[15,4],[14,5],[15,5],[16,5]], names:["Atlas","Lyra","Orion","Nova","Vega"], p:{priority:0.7,social_mode:0.6,risk_tolerance:0.4,curiosity:0.7,cooperation:0.6} },
        { cells:[[14,10],[15,10],[14,11],[15,11],[16,12]], names:["Zola","Amara","Kofi","Nia","Jabari"], p:{priority:0.5,social_mode:0.8,risk_tolerance:0.5,curiosity:0.5,cooperation:0.8} },
        { cells:[[21,6],[22,6],[23,6],[21,7],[22,7]], names:["Kai","Yuki","Lin","Haru","Ming"], p:{priority:0.8,social_mode:0.5,risk_tolerance:0.3,curiosity:0.6,cooperation:0.7} },
        { cells:[[24,17],[25,17],[26,17],[24,18],[25,18]], names:["Reef","Dune","Opal","Wren","Blaze"], p:{priority:0.4,social_mode:0.6,risk_tolerance:0.8,curiosity:0.9,cooperation:0.5} },
      ];
      const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
      const ownerId = profiles?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
      const seedAgents: Partial<Agent>[] = [];
      for (const cont of SEED) {
        for (let i = 0; i < cont.cells.length; i++) {
          const [x, y] = cont.cells[i];
          if (!isLand(x, y)) continue;
          const p: Record<string, number> = {};
          for (const [k, v] of Object.entries(cont.p)) p[k] = Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.2));
          seedAgents.push({
            owner_id: ownerId, name: cont.names[i], x, y,
            energy: 80, materials: 10, knowledge: 0,
            max_age: 2000 + Math.floor(Math.random() * 800),
            personality: p as any, generation: 0, role: "generalist",
          });
        }
      }
      if (seedAgents.length > 0) {
        await supabase.from("agents").insert(seedAgents);
        const { data: reloaded } = await supabase.from("agents").select("*").eq("alive", true);
        agents = reloaded ?? [];
      }
    }

    const deaths: string[] = [];
    const newActions: { agent_id: string; tick: number; action_type: string; detail: Record<string, unknown> }[] = [];
    const newEvents: { tick: number; event_type: string; detail: Record<string, unknown> }[] = [];
    const newMemories: { agent_id: string; memory_type: string; content: string; importance: number; tick: number; category?: string }[] = [];
    const babyAgents: Partial<Agent>[] = [];

    // Load profiles for quest checking (user quests need llm_api_key / telegram_bot_token)
    const ownerIds = [...new Set(agents.filter(a => a.alive).map(a => a.owner_id))];
    const profileMap: Record<string, { llm_api_key?: string; telegram_bot_token?: string }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles")
        .select("id, llm_api_key, telegram_bot_token")
        .in("id", ownerIds);
      for (const p of profiles ?? []) profileMap[p.id] = p;
    }

    // Fix ocean-stuck agents
    for (const agent of agents) {
      if (!agent.alive || isLand(agent.x, agent.y)) continue;
      for (let r = 1; r < 10; r++) {
        const found: [number, number][] = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if ((Math.abs(dx) === r || Math.abs(dy) === r) && isLand(agent.x + dx, agent.y + dy))
            found.push([agent.x + dx, agent.y + dy]);
        }
        if (found.length > 0) { const [nx, ny] = found[Math.floor(Math.random() * found.length)]; agent.x = nx; agent.y = ny; break; }
      }
    }

    // ─── Per-Agent Tick ────────────────────────────────────────────
    for (const agent of agents) {
      if (!agent.alive) continue;
      agent.age += 1;

      // Auto-assign role every 50 ticks
      if (agent.age % 50 === 0) {
        agent.role = assignRole(agent.personality, agent.age);
      }
      const role = ROLES[agent.role] ?? ROLES.generalist;

      // Death by old age
      if (agent.age >= agent.max_age) {
        agent.alive = false; agent.energy = 0;
        (agent as any).cause_of_death = "age"; deaths.push(agent.id);
        newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "age", age: agent.age } });
        continue;
      }

      // Prison
      const imprisoned = agent.imprisoned_until && tick < agent.imprisoned_until;
      if (imprisoned) {
        agent.energy -= 0.3;
        if (agent.energy <= 0) {
          agent.alive = false; agent.energy = 0;
          (agent as any).cause_of_death = "hunger"; deaths.push(agent.id);
          newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "hunger_in_prison" } });
        }
        continue;
      }
      if (agent.imprisoned_until && tick >= agent.imprisoned_until) agent.imprisoned_until = null;

      // Cycle reset
      if (tick - agent.cycle_start_tick >= DAY_LENGTH) {
        agent.work_ticks = 0; agent.free_ticks = 0; agent.sleep_ticks = 0; agent.cycle_start_tick = tick;
      }
      if (agent.forced_phase === "free" && agent.free_ticks > 120) agent.forced_phase = null;

      const agentPhase = getAgentPhase(agent, tick);
      agent.day_phase = agentPhase;
      if (agentPhase === "work") agent.work_ticks++;
      else if (agentPhase === "free") agent.free_ticks++;
      else if (agentPhase === "sleep") agent.sleep_ticks++;

      // ─── SLEEP PHASE ────────────────────────────────────────────
      if (agentPhase === "sleep") {
        const sleepRegen = 0.5 + (isTechResearched(researched, "medicine") ? 0.3 : 0);
        agent.energy = Math.min(100, agent.energy + sleepRegen);

        // Memory consolidation every 40 sleep ticks
        if (agent.sleep_ticks > 0 && agent.sleep_ticks % 40 === 0) {
          const { data: shortMems } = await supabase.from("agent_memory").select("id, content, importance")
            .eq("agent_id", agent.id).eq("memory_type", "short").order("importance", { ascending: false }).limit(3);
          if (shortMems?.length) {
            newMemories.push({ agent_id: agent.id, memory_type: "long", content: shortMems[0].content, importance: shortMems[0].importance + 0.1, tick });
          }
          // Cleanup short (max 20)
          const { data: allShort } = await supabase.from("agent_memory").select("id").eq("agent_id", agent.id).eq("memory_type", "short").order("tick", { ascending: true });
          if (allShort && allShort.length > 20) {
            await supabase.from("agent_memory").delete().in("id", allShort.slice(0, allShort.length - 20).map(m => m.id));
          }
          // Cleanup long (max 10)
          const { data: allLong } = await supabase.from("agent_memory").select("id").eq("agent_id", agent.id).eq("memory_type", "long").order("importance", { ascending: true });
          if (allLong && allLong.length > 10) {
            await supabase.from("agent_memory").delete().in("id", allLong.slice(0, allLong.length - 10).map(m => m.id));
          }
        }
        continue;
      }

      // ─── AWAKE: Harvest tile yields ─────────────────────────────
      const currentTileType = tiles[tileIdx(agent.x, agent.y, gridSize)];
      const baseYield = TILE_YIELDS[currentTileType] ?? TILE_YIELDS.e;
      const onShelter = currentTileType === "s";

      // Apply role multipliers + season + tech bonuses
      let foodYield = baseYield.food * role.foodMult * seasonMult.food;
      let matYield = baseYield.materials * role.materialsMult * seasonMult.materials;
      let knowYield = baseYield.knowledge * role.knowledgeMult;

      if (isTechResearched(researched, "agriculture") && currentTileType === "F") foodYield *= 1.5;
      if (isTechResearched(researched, "philosophy") && agent.role === "researcher") knowYield *= 2.0;

      agent.energy = Math.min(100, agent.energy + foodYield);
      agent.materials = Math.min(100, (agent.materials ?? 0) + matYield);
      agent.knowledge = Math.min(100, (agent.knowledge ?? 0) + knowYield);

      // Track total food collected for quests
      if (foodYield > 0) {
        agent.total_food_collected = (agent.total_food_collected ?? 0) + foodYield;
      }

      // Energy cost
      const popPressure = agents.filter(a => a.alive).length > MAX_POPULATION
        ? 0.3 + (agents.filter(a => a.alive).length - MAX_POPULATION) * 0.05 : 0;
      agent.energy -= energyCost(season, onShelter) + popPressure;

      if (agent.energy <= 0) {
        agent.alive = false; agent.energy = 0;
        (agent as any).cause_of_death = "hunger"; deaths.push(agent.id);
        newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "hunger" } });
        continue;
      }

      // ─── MOVE TARGET (user click-to-move) ───────────────────────
      if (agent.move_target_x != null && agent.move_target_y != null && hasAbility(agent, "move")) {
        const moved = moveTowardTarget(agent, gridSize);
        // If agent has move_far ability, take a second step
        if (moved && hasAbility(agent, "move_far") && agent.move_target_x != null) {
          moveTowardTarget(agent, gridSize);
        }
      }

      // ─── Track has_met_other (quest) ────────────────────────────
      if (!agent.has_met_other) {
        const sameHex = agents.filter(o => o.id !== agent.id && o.alive && o.x === agent.x && o.y === agent.y);
        if (sameHex.length > 0) agent.has_met_other = true;
      }

      // ─── ACTION DECISION ─────────────────────────────────────────
      const suggestion = agent.pending_suggestion;
      agent.pending_suggestion = null;
      let action = "idle";
      let detail: Record<string, unknown> = {};
      const nearTiles = landNeighbors(agent.x, agent.y, gridSize);

      if (suggestion && typeof suggestion === "object" && "action" in suggestion) {
        action = String(suggestion.action);
        detail = suggestion as Record<string, unknown>;

        // Build action with materials cost (requires 'build' ability)
        if ((action === "build" || action === "farm") && !hasAbility(agent, "build")) {
          action = "idle"; detail = { reason: "no_build_ability" };
        }
        if (action === "build" || action === "farm") {
          const buildType = action === "farm" ? "F" : String(detail.type || "b");
          const cost = BUILD_COSTS[buildType];
          const currTile = tiles[tileIdx(agent.x, agent.y, gridSize)];
          const matCost = (cost?.materials ?? 10) * role.buildCostMult;
          const enCost = (cost?.energy ?? 15) * role.buildCostMult;
          const toolDiscount = isTechResearched(researched, "toolmaking") ? 0.8 : 1.0;

          if (cost && cost.from.includes(currTile) && agent.energy > enCost * toolDiscount + 10 && agent.materials >= matCost * toolDiscount) {
            agent.energy -= enCost * toolDiscount;
            agent.materials -= matCost * toolDiscount;
            tiles[tileIdx(agent.x, agent.y, gridSize)] = buildType;
            agent.reputation = Math.min(1, agent.reputation + 0.02);
            agent.has_built = true; // Quest tracking
            // buildings_built counter
            const built = (agent as any).buildings_built ?? {};
            const tileType = buildType;
            built[tileType] = (built[tileType] ?? 0) + 1;
            (agent as any).buildings_built = built;
            detail = { built: buildType, at: [agent.x, agent.y] };
            newEvents.push({ tick, event_type: "build", detail: { builder: agent.name, type: buildType, at: [agent.x, agent.y] } });
          } else {
            action = "idle"; detail = { reason: "insufficient_resources" };
          }
        }

        // Move action
        if (action === "move" && detail.direction) {
          const dir = String(detail.direction);
          let dx = 0, dy = 0;
          if (dir === "north") dy = -1; else if (dir === "south") dy = 1;
          else if (dir === "east") dx = 1; else if (dir === "west") dx = -1;
          const onRoad = currentTileType === "r";
          const steps = onRoad ? 2 : 1;
          const newX = Math.max(0, Math.min(gridSize - 1, agent.x + dx * steps));
          const newY = Math.max(0, Math.min(gridSize - 1, agent.y + dy * steps));
          if (isLand(newX, newY)) {
            agent.x = newX; agent.y = newY;
            detail = { to: [agent.x, agent.y], road_bonus: onRoad };
            const visitedMv: number[] = (agent as any).tiles_visited ?? [];
            const tileKeyMv = agent.y * 60 + agent.x;
            if (!visitedMv.includes(tileKeyMv)) {
              visitedMv.push(tileKeyMv);
              if (visitedMv.length > 200) visitedMv.shift();
              (agent as any).tiles_visited = visitedMv;
            }
          } else {
            const hasPort = hexNeighbors(agent.x, agent.y, gridSize).some(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "P");
            if (hasPort) {
              const maxDist = isTechResearched(researched, "navigation") ? 12 : 8;
              for (let dist = 2; dist <= maxDist; dist++) {
                const tx = Math.max(0, Math.min(gridSize - 1, agent.x + dx * dist));
                const ty = Math.max(0, Math.min(gridSize - 1, agent.y + dy * dist));
                if (isLand(tx, ty)) {
                  agent.x = tx; agent.y = ty; agent.energy -= 5;
                  detail = { to: [agent.x, agent.y], ocean_crossing: true };
                  newEvents.push({ tick, event_type: "voyage", detail: { agent: agent.name, to: [tx, ty] } });
                  break;
                }
              }
            }
          }
        }

        // Combat action (new!)
        if (action === "attack" && detail.target) {
          const target = agents.find(a => a.alive && a.name === detail.target && hexDistance(agent.x, agent.y, a.x, a.y) <= 1);
          if (target) {
            const tileType = tiles[tileIdx(target.x, target.y, gridSize)];
            const targetRole = ROLES[target.role] ?? ROLES.generalist;
            const agentRole = ROLES[agent.role] ?? ROLES.generalist;
            const masonryBonus = isTechResearched(researched, "masonry") && tileType === "b" ? 1.5 : 1.0;
            const fortBonus = isTechResearched(researched, "fortification") && tileType === "s" ? 2.0 : 1.0;

            const result = resolveCombat(
              agent.attack * agentRole.attackMult, agent.defense * agentRole.defenseMult,
              target.attack * targetRole.attackMult, target.defense * targetRole.defenseMult * masonryBonus * fortBonus,
              getTerrainDefenseBonus(tileType), tileType === "s",
              agent.veteran, target.veteran
            );

            if (result.attackerWins) {
              target.energy -= result.damageToLoser;
              agent.reputation = Math.max(-1, agent.reputation - 0.2);
              if (result.veteranGained) agent.veteran = true;
              if (target.energy <= 0) {
                target.alive = false; target.energy = 0;
                (target as any).cause_of_death = "killed"; deaths.push(target.id);
                agent.kills++;
                newEvents.push({ tick, event_type: "death", detail: { name: target.name, cause: "killed", killer: agent.name } });
              }
              detail = { target: target.name, won: true, damage: Math.round(result.damageToLoser) };
            } else {
              agent.energy -= result.damageToLoser;
              if (result.veteranGained) target.veteran = true;
              if (agent.energy <= 0) {
                agent.alive = false; agent.energy = 0;
                (agent as any).cause_of_death = "killed"; deaths.push(agent.id);
                target.kills++;
                newEvents.push({ tick, event_type: "death", detail: { name: agent.name, cause: "killed", killer: target.name } });
              }
              detail = { target: target.name, won: false, damage: Math.round(result.damageToLoser) };
            }
            newEvents.push({ tick, event_type: "combat", detail: { attacker: agent.name, defender: target.name, ...detail } });
          }
        }
      } else {
        // ─── AI-driven actions (no LLM suggestion) ─────────────────
        const currentTile = tiles[tileIdx(agent.x, agent.y, gridSize)];

        if (currentTile === "A") {
          // Hunt wild animal — always prioritized
          const huntBonus = hasAbility(agent, "hunting") ? 1.5 : 1.0;
          const foodGained = Math.round(20 * huntBonus);
          action = "hunt"; agent.energy = Math.min(100, agent.energy + foodGained);
          agent.total_food_collected = (agent.total_food_collected ?? 0) + foodGained;
          agent.hunts = (agent.hunts ?? 0) + 1;
          tiles[tileIdx(agent.x, agent.y, gridSize)] = "e"; // Animal consumed
          detail = { gained: foodGained, hunts: agent.hunts };
          newMemories.push({ agent_id: agent.id, memory_type: "short", content: `Tier gejagt bei (${agent.x},${agent.y}). ${foodGained} Nahrung erhalten.`, importance: 0.5, tick });
          newEvents.push({ tick, event_type: "hunt", detail: { hunter: agent.name, at: [agent.x, agent.y], food: foodGained } });
        } else if (currentTile === "f") {
          action = "eat"; agent.energy = Math.min(100, agent.energy + 15);
          agent.total_food_collected = (agent.total_food_collected ?? 0) + 15; // Quest tracking
          tiles[tileIdx(agent.x, agent.y, gridSize)] = "e"; detail = { gained: 15 };
          (agent as any).eat_count = ((agent as any).eat_count ?? 0) + 1;
        } else if (currentTile === "w") {
          action = "drink"; agent.energy = Math.min(100, agent.energy + 5); detail = { gained: 5 };
          (agent as any).drink_count = ((agent as any).drink_count ?? 0) + 1;
        } else {
          const foodTiles = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "f");

          // Building (work phase, cooperative, has materials, requires 'build' ability)
          if (agentPhase === "work" && hasAbility(agent, "build") && agent.energy > 40 && agent.materials > 10 && currentTile === "e" && agent.personality.cooperation > 0.4) {
            const nearFood = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "f").length;
            const nearShelter = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "s").length;
            const nearFarm = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "F").length;
            let buildType = "b";
            if (season === "autumn" && nearShelter === 0) buildType = "s";
            else if (nearFood < 2 && nearFarm === 0 && agent.personality.priority > 0.5) buildType = "F";
            else if (agent.personality.curiosity > 0.6) buildType = "r";

            const cost = BUILD_COSTS[buildType];
            const toolDiscount = isTechResearched(researched, "toolmaking") ? 0.8 : 1.0;
            if (cost && agent.energy > cost.energy * toolDiscount + 15 && agent.materials >= cost.materials * toolDiscount) {
              agent.energy -= cost.energy * toolDiscount;
              agent.materials -= cost.materials * toolDiscount;
              tiles[tileIdx(agent.x, agent.y, gridSize)] = buildType;
              action = "build"; detail = { built: buildType, at: [agent.x, agent.y] };
              agent.reputation = Math.min(1, agent.reputation + 0.02);
              agent.has_built = true; // Quest tracking
              newEvents.push({ tick, event_type: "build", detail: { builder: agent.name, type: buildType, at: [agent.x, agent.y] } });
            }
          } else {
            // Look for nearby animals to hunt
            const animalTiles = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "A");
            if (animalTiles.length > 0 && agent.energy < 80) {
              const [ax, ay] = animalTiles[Math.floor(Math.random() * animalTiles.length)];
              agent.x = ax; agent.y = ay;
              const huntBonus = hasAbility(agent, "hunting") ? 1.5 : 1.0;
              const foodGained = Math.round(20 * huntBonus);
              agent.energy = Math.min(100, agent.energy + foodGained);
              agent.total_food_collected = (agent.total_food_collected ?? 0) + foodGained;
              agent.hunts = (agent.hunts ?? 0) + 1;
              tiles[tileIdx(ax, ay, gridSize)] = "e";
              action = "hunt"; detail = { to: [ax, ay], gained: foodGained, hunts: agent.hunts };
              newMemories.push({ agent_id: agent.id, memory_type: "short", content: `Tier gejagt bei (${ax},${ay}). ${foodGained} Nahrung.`, importance: 0.5, tick });
              newEvents.push({ tick, event_type: "hunt", detail: { hunter: agent.name, at: [ax, ay], food: foodGained } });
            } else if (foodTiles.length > 0 && agent.energy < 60) {
              const [fx, fy] = foodTiles[Math.floor(Math.random() * foodTiles.length)];
              agent.x = fx; agent.y = fy;
              action = "move_to_food"; detail = { to: [fx, fy] };
            } else if (agentPhase === "work" && agent.role === "researcher") {
              action = "research"; detail = { points: knowYield };
            } else if (agentPhase === "free") {
              const nearAgents = agents.filter(
                o => o.id !== agent.id && o.alive && hexDistance(agent.x, agent.y, o.x, o.y) <= 2
              );
              if (nearAgents.length > 0 && agent.personality.social_mode > 0.4) {
                const good = nearAgents.filter(a => a.reputation >= -0.2);
                const partner = good.length > 0 ? good[Math.floor(Math.random() * good.length)] : null;
                if (partner) {
                  action = "socialize"; agent.reputation = Math.min(1, agent.reputation + 0.02);
                  partner.reputation = Math.min(1, partner.reputation + 0.01);
                  detail = { with: partner.name };
                }
              } else if (nearAgents.length > 0 && agent.personality.cooperation < 0.3 && agent.energy < 40) {
                const victim = nearAgents.find(a => a.energy > 30);
                if (victim) {
                  const stolen = Math.min(10, victim.energy - 10);
                  if (stolen > 0) {
                    agent.energy = Math.min(100, agent.energy + stolen); victim.energy -= stolen;
                    agent.reputation = Math.max(-1, agent.reputation - 0.15);
                    action = "steal"; detail = { from: victim.name, amount: stolen };
                    newEvents.push({ tick, event_type: "crime", detail: { thief: agent.name, victim: victim.name, amount: stolen } });
                  }
                }
              } else {
                const walkable = landNeighbors(agent.x, agent.y, gridSize);
                if (walkable.length > 0) {
                  const [nx, ny] = walkable[Math.floor(Math.random() * walkable.length)];
                  if (currentTile === "r") {
                    const further = landNeighbors(nx, ny, gridSize).filter(([fx, fy]) => fx !== agent.x || fy !== agent.y);
                    if (further.length > 0) { const [fx, fy] = further[Math.floor(Math.random() * further.length)]; agent.x = fx; agent.y = fy; }
                    else { agent.x = nx; agent.y = ny; }
                  } else { agent.x = nx; agent.y = ny; }
                  action = "explore"; detail = { to: [agent.x, agent.y] };
                  const visitedEx: number[] = (agent as any).tiles_visited ?? [];
                  const tileKeyEx = agent.y * 60 + agent.x;
                  if (!visitedEx.includes(tileKeyEx)) {
                    visitedEx.push(tileKeyEx);
                    if (visitedEx.length > 200) visitedEx.shift();
                    (agent as any).tiles_visited = visitedEx;
                  }
                }
              }
            } else {
              // Default: move toward resources
              const waterTiles = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "w");
              if (waterTiles.length > 0) {
                const [wx, wy] = waterTiles[0]; agent.x = wx; agent.y = wy;
                action = "move_to_water"; detail = { to: [wx, wy] };
              } else {
                const walkable = nearTiles.filter(([nx, ny]) => { const t = tiles[tileIdx(nx, ny, gridSize)]; return t !== "o" && t !== "d"; });
                if (walkable.length > 0) {
                  const [ex, ey] = walkable[Math.floor(Math.random() * walkable.length)];
                  agent.x = ex; agent.y = ey; action = "wander"; detail = { to: [ex, ey] };
                }
              }
            }
          }
        }
      }

      // Memories
      if (action === "eat") newMemories.push({ agent_id: agent.id, memory_type: "short", content: `Nahrung bei (${agent.x},${agent.y}).`, importance: 0.3, tick });
      else if (action === "build") {
        const bn: Record<string, string> = { b: "Gebäude", s: "Shelter", F: "Farm", r: "Straße", P: "Hafen" };
        newMemories.push({ agent_id: agent.id, memory_type: "short", content: `${bn[String(detail.built)] ?? "Struktur"} gebaut bei (${agent.x},${agent.y}).`, importance: 0.6, tick });
      } else if (action === "socialize") newMemories.push({ agent_id: agent.id, memory_type: "short", content: `Mit ${detail.with} geredet.`, importance: 0.4, tick });
      else if (action === "steal") newMemories.push({ agent_id: agent.id, memory_type: "short", content: `Energie von ${detail.from} gestohlen.`, importance: 0.7, tick });

      // Energy sharing (cooperative agents)
      if (agentPhase === "free" && agent.energy > 30) {
        const needy = agents.filter(o => o.id !== agent.id && o.alive && o.energy < 20 && hexDistance(agent.x, agent.y, o.x, o.y) <= 1);
        if (needy.length > 0 && agent.personality.cooperation > 0.6) {
          const r = needy[0]; const share = Math.min(10, agent.energy - 20);
          if (share > 0) {
            agent.energy -= share; r.energy += share;
            agent.reputation = Math.min(1, agent.reputation + 0.05);
            newActions.push({ agent_id: agent.id, tick, action_type: "share_energy", detail: { to: r.name, amount: share } });
          }
        }
      }

      // ─── Quest Completion Check ──────────────────────────────────
      const newQuests = checkAndGrantQuests(agent, profileMap[agent.owner_id]);
      if (newQuests.length > 0) {
        for (const qid of newQuests) {
          newEvents.push({ tick, event_type: "quest_completed", detail: { agent_id: agent.id, agent_name: agent.name, quest_id: qid } });
          newMemories.push({ agent_id: agent.id, memory_type: "long", content: `Quest "${qid}" abgeschlossen! Neue Fähigkeiten freigeschaltet.`, importance: 0.9, tick });
        }
      }

      newActions.push({ agent_id: agent.id, tick, action_type: action, detail });
    }

    // ─── Trading (every 10 ticks) ─────────────────────────────────
    if (tick % 10 === 0) {
      const traded = new Set<string>();
      for (const agent of agents) {
        if (!agent.alive || agent.imprisoned_until || traded.has(agent.id)) continue;
        if (agent.materials < 5 || agent.personality.cooperation < 0.3 || !hasAbility(agent, "trade")) continue;
        const partners = agents.filter(o => o.id !== agent.id && o.alive && !o.imprisoned_until && !traded.has(o.id)
          && hexDistance(agent.x, agent.y, o.x, o.y) <= 1 && o.materials < 5);
        if (partners.length === 0) continue;
        const p = partners[0]; traded.add(agent.id); traded.add(p.id);
        const tradeBonus = isTechResearched(researched, "trade_routes") ? 3 : 2;
        const amt = Math.min(tradeBonus, agent.materials);
        agent.materials -= amt; p.materials += amt;
        agent.reputation = Math.min(1, agent.reputation + 0.03);
        (agent as any).trades_completed = ((agent as any).trades_completed ?? 0) + 1;
        newEvents.push({ tick, event_type: "trade", detail: { from: agent.name, to: p.name, amount: amt } });
      }
    }

    // ─── Teaching (every 20 ticks) ────────────────────────────────
    if (tick % 20 === 0) {
      const taught = new Set<string>();
      for (const teacher of agents) {
        if (!teacher.alive || teacher.imprisoned_until || taught.has(teacher.id) || teacher.age < 500 || teacher.personality.social_mode < 0.5) continue;
        const students = agents.filter(o => o.id !== teacher.id && o.alive && !taught.has(o.id) && hexDistance(teacher.x, teacher.y, o.x, o.y) <= 2 && o.age < 300);
        if (students.length === 0) continue;
        const s = students[0]; taught.add(teacher.id); taught.add(s.id);
        const { data: tMems } = await supabase.from("agent_memory").select("content, importance")
          .eq("agent_id", teacher.id).eq("memory_type", "long").order("importance", { ascending: false }).limit(3);
        if (tMems?.length) {
          const m = tMems[Math.floor(Math.random() * tMems.length)];
          const knowBonus = isTechResearched(researched, "writing") ? 1.5 : 1.0;
          newMemories.push({ agent_id: s.id, memory_type: "long", content: `[Gelernt von ${teacher.name}] ${m.content}`, importance: m.importance * 0.7 * knowBonus, tick });
          teacher.reputation = Math.min(1, teacher.reputation + 0.03);
          s.knowledge = Math.min(100, (s.knowledge ?? 0) + 2 * knowBonus);
          newEvents.push({ tick, event_type: "teach", detail: { teacher: teacher.name, student: s.name } });
        }
      }
    }

    // ─── Tech Research (collective, every tick) ───────────────────
    {
      // All researchers contribute knowledge to global research
      const researcherKnowledge = agents
        .filter(a => a.alive && (a.role === "researcher" || a.personality.curiosity > 0.6))
        .reduce((sum, a) => sum + (a.knowledge ?? 0) * 0.01, 0);

      if (researcherKnowledge > 0) {
        if (!currentResearch) {
          const next = getNextResearch(researched);
          if (next) currentResearch = next.name;
        }
        if (currentResearch) {
          researchPoints += researcherKnowledge;
          const tech = TECH_TREE.find(t => t.name === currentResearch);
          if (tech && researchPoints >= tech.cost) {
            researched.push(currentResearch);
            researchPoints = 0;
            currentResearch = null;
            newEvents.push({ tick, event_type: "tech_discovered", detail: { tech: tech.name, label: tech.label, effect: tech.effect } });
          }
        }
      }
    }

    // ─── Alliance Formation (every 40 ticks) ──────────────────────
    if (tick % 40 === 0) {
      const unallied = agents.filter(a => a.alive && !a.alliance_id && a.personality.social_mode > 0.6 && a.reputation > 0 && hasAbility(a, "alliance"));
      for (const agent of unallied) {
        const nearby = unallied.filter(o => o.id !== agent.id && !o.alliance_id
          && hexDistance(agent.x, agent.y, o.x, o.y) <= 3 && o.reputation > 0);
        if (nearby.length >= 2) {
          // Form alliance
          const allianceName = `${agent.name}s Bund`;
          const { data: alliance } = await supabase.from("alliances")
            .insert({ name: allianceName, founder_id: agent.id, government: "tribe" })
            .select().single();
          if (alliance) {
            agent.alliance_id = alliance.id;
            for (const m of nearby.slice(0, 4)) m.alliance_id = alliance.id;
            newEvents.push({ tick, event_type: "alliance_formed", detail: { name: allianceName, founder: agent.name, members: [agent.name, ...nearby.slice(0, 4).map(m => m.name)] } });
          }
          break; // Only one alliance per tick
        }
      }
    }

    // ─── Arrest Mechanic ──────────────────────────────────────────
    if (dayPhase === "work" || dayPhase === "free") {
      for (const agent of agents) {
        if (!agent.alive || agent.imprisoned_until) continue;
        const near = agents.filter(o => o.id !== agent.id && o.alive && !o.imprisoned_until && hexDistance(agent.x, agent.y, o.x, o.y) <= 1);
        for (const target of near) {
          if (target.reputation >= -0.2) continue;
          const witnesses = near.filter(w => w.id !== target.id && w.reputation > 0);
          if (witnesses.length >= 1 && agent.reputation > 0) {
            target.imprisoned_until = tick + 100;
            target.reputation = Math.max(-1, target.reputation - 0.1);
            agent.reputation = Math.min(1, agent.reputation + 0.03);
            newEvents.push({ tick, event_type: "arrest", detail: { arrested: target.name, by: agent.name, until: tick + 100 } });
            newMemories.push({ agent_id: agent.id, memory_type: "short", content: `${target.name} verhaftet.`, importance: 0.8, tick });
            newMemories.push({ agent_id: target.id, memory_type: "short", content: `Von ${agent.name} verhaftet bis Tick ${tick + 100}.`, importance: 0.9, tick });
          }
        }
      }
    }

    // ─── Communication ────────────────────────────────────────────
    if (dayPhase === "free" && tick % 5 === 0) {
      for (const agent of agents) {
        if (!agent.alive || agent.imprisoned_until || agent.personality.social_mode < 0.5) continue;
        const near = agents.filter(o => o.id !== agent.id && o.alive && !o.imprisoned_until && hexDistance(agent.x, agent.y, o.x, o.y) <= 2);
        if (near.length === 0) continue;
        const partner = near[Math.floor(Math.random() * near.length)];
        newEvents.push({ tick, event_type: "communication", detail: { from: agent.name, to: partner.name, topic: agent.energy < 40 ? "hunger" : agent.reputation > 0.5 ? "cooperation" : "exploration" } });
      }
    }

    // ─── Reproduction ─────────────────────────────────────────────
    const aliveCount = agents.filter(a => a.alive).length + babyAgents.length;
    if (tick % 80 === 0 && aliveCount < MAX_POPULATION && babyAgents.length === 0) {
      const fertile = agents.filter(a => a.alive && a.energy > 65 && !a.imprisoned_until);
      const paired = new Set<string>();
      for (const a of fertile) {
        if (paired.has(a.id) || babyAgents.length >= 1) continue;
        const partner = fertile.find(b => b.id !== a.id && !paired.has(b.id) && hexDistance(a.x, a.y, b.x, b.y) <= 1 && b.reputation > -0.3 && a.reputation > -0.3);
        if (!partner) continue;
        paired.add(a.id); paired.add(partner.id);
        a.energy -= 20; partner.energy -= 20;

        const childP: Record<string, number> = {};
        for (const key of ["priority", "social_mode", "risk_tolerance", "curiosity", "cooperation"]) {
          childP[key] = Math.max(0, Math.min(1, (a.personality[key] + partner.personality[key]) / 2 + (Math.random() - 0.5) * 0.2));
        }
        const spawnTiles = landNeighbors(a.x, a.y, gridSize).filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] !== "d");
        const [cx, cy] = spawnTiles.length > 0 ? spawnTiles[Math.floor(Math.random() * spawnTiles.length)] : [a.x, a.y];
        const gen = Math.max(a.generation, partner.generation) + 1;
        const childName = CHILD_NAMES[Math.floor(Math.random() * CHILD_NAMES.length)] + "-" + gen;

        const ownerForChild = a.owner_id ?? partner.owner_id;
        const { count: parentAchCount } = await supabase
          .from("dynasty_achievements")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ownerForChild ?? "");
        const childMaxAge = computeMaxAge(parentAchCount ?? 0);

        babyAgents.push({
          owner_id: a.owner_id, name: childName, x: cx, y: cy,
          energy: 50, materials: 5, knowledge: 0,
          max_age: childMaxAge,
          personality: childP as any, generation: gen,
          parent_a_id: a.id, parent_b_id: partner.id,
          role: "generalist", attack: 1.0, defense: 1.0,
        });
        newEvents.push({ tick, event_type: "birth", detail: { parent_a: a.name, parent_b: partner.name, child: childName } });
        newMemories.push({ agent_id: a.id, memory_type: "long", content: `Kind "${childName}" mit ${partner.name}.`, importance: 0.95, tick });
        newMemories.push({ agent_id: partner.id, memory_type: "long", content: `Kind "${childName}" mit ${a.name}.`, importance: 0.95, tick });
      }
    }

    // ─── Food Spawn ───────────────────────────────────────────────
    if (tick % FOOD_SPAWN_INTERVAL === 0) {
      const rate = foodSpawnRate(season);
      for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
        if (!isLand(x, y)) continue;
        const idx = tileIdx(x, y, gridSize);
        if (tiles[idx] === "e" && Math.random() < rate) tiles[idx] = "f";
      }
      const farmRadius = FARM_SPAWN_RADIUS + (isTechResearched(researched, "irrigation") ? 1 : 0);
      for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
        if (tiles[tileIdx(x, y, gridSize)] === "F") {
          for (const [nx, ny] of hexCellsInRadius(x, y, farmRadius, gridSize)) {
            if (isLand(nx, ny) && tiles[tileIdx(nx, ny, gridSize)] === "e" && Math.random() < FARM_SPAWN_CHANCE)
              tiles[tileIdx(nx, ny, gridSize)] = "f";
          }
        }
      }
    }

    // ─── Wildlife Spawn (every 8 ticks) ─────────────────────────
    if (tick % 8 === 0) {
      // Count existing animals
      let animalCount = 0;
      for (let i = 0; i < tiles.length; i++) if (tiles[i] === "A") animalCount++;
      const maxAnimals = Math.max(5, Math.floor(agents.filter(a => a.alive).length * 0.4));
      if (animalCount < maxAnimals) {
        // Spawn animals on land tiles (empty, food, road — not buildings/shelters)
        const spawnRate = season === "spring" ? 0.06 : season === "summer" ? 0.08 : season === "autumn" ? 0.04 : 0.02;
        const SPAWNABLE = new Set(["e", "f", "r"]);
        for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
          if (!isLand(x, y)) continue;
          const idx = tileIdx(x, y, gridSize);
          if (!SPAWNABLE.has(tiles[idx])) continue;
          if (animalCount >= maxAnimals) break;
          // Higher spawn chance near food/water (natural habitat)
          const nearFood = hexNeighbors(x, y, gridSize).some(([nx, ny]) => {
            const t = tiles[tileIdx(nx, ny, gridSize)];
            return t === "f" || t === "w" || t === "F";
          });
          if (Math.random() < (nearFood ? spawnRate * 2 : spawnRate)) {
            tiles[idx] = "A";
            animalCount++;
          }
        }
      }
    }

    // ─── Move wildlife (every 3 ticks) ───────────────────────────
    if (tick % 3 === 0) {
      for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
        const idx = tileIdx(x, y, gridSize);
        if (tiles[idx] !== "A") continue;
        // 30% chance to move to a neighbor
        if (Math.random() > 0.3) continue;
        const nbrs = landNeighbors(x, y, gridSize).filter(([nx, ny]) => {
          const t = tiles[tileIdx(nx, ny, gridSize)];
          return t === "e" || t === "f" || t === "r"; // Animals can walk on empty/food/road tiles
        });
        if (nbrs.length > 0) {
          const [nx, ny] = nbrs[Math.floor(Math.random() * nbrs.length)];
          const targetTile = tiles[tileIdx(nx, ny, gridSize)];
          tiles[idx] = "e"; // Leave old tile empty
          tiles[tileIdx(nx, ny, gridSize)] = "A"; // Move animal to new tile
        }
      }
    }

    // ─── Disasters ────────────────────────────────────────────────
    if (tick % DISASTER_INTERVAL === 0 && Math.random() < 0.3) {
      const landCells: [number, number][] = [];
      for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) if (isLand(x, y)) landCells.push([x, y]);
      if (landCells.length > 0) {
        const [cx, cy] = landCells[Math.floor(Math.random() * landCells.length)];
        const radius = 2 + Math.floor(Math.random() * 2);
        let affected = 0;
        for (const [nx, ny] of hexCellsInRadius(cx, cy, radius, gridSize)) {
          if (isLand(nx, ny)) {
            const idx = tileIdx(nx, ny, gridSize);
            if (tiles[idx] === "f" || tiles[idx] === "F") { tiles[idx] = "e"; affected++; }
          }
        }
        if (affected > 0) {
          const type = season === "winter" ? "blizzard" : season === "summer" ? "drought" : "storm";
          newEvents.push({ tick, event_type: "disaster", detail: { type, center: [cx, cy], radius, tiles_destroyed: affected } });
          for (const agent of agents) {
            if (agent.alive && hexDistance(agent.x, agent.y, cx, cy) <= radius) {
              const dmg = 10 + Math.random() * 15;
              agent.energy -= dmg;
              agent.materials = Math.max(0, (agent.materials ?? 0) - 3);
              newMemories.push({ agent_id: agent.id, memory_type: "short", content: `${type} bei (${cx},${cy}) überlebt. ${Math.round(dmg)} Schaden.`, importance: 0.8, tick });
              if (agent.energy <= 0) {
                agent.alive = false; agent.energy = 0;
                (agent as any).cause_of_death = "disaster"; deaths.push(agent.id);
                newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "disaster" } });
              }
            }
          }
        }
      }
    }

    if (tick % SEASON_LENGTH === 0) newEvents.push({ tick, event_type: "season_change", detail: { season } });

    // ─── Deliver Reminders ────────────────────────────────────────
    {
      const { data: dueReminders } = await supabase.from("agent_reminders")
        .select("id, agent_id, owner_id, content").eq("delivered", false).lte("remind_at", new Date().toISOString());
      if (dueReminders?.length) {
        for (const rem of dueReminders) {
          const { data: prof } = await supabase.from("profiles").select("telegram_bot_token, telegram_chat_id").eq("id", rem.owner_id).single();
          if (prof?.telegram_bot_token && prof?.telegram_chat_id) {
            const { data: ag } = await supabase.from("agents").select("name").eq("id", rem.agent_id).single();
            await fetch(`https://api.telegram.org/bot${prof.telegram_bot_token}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: prof.telegram_chat_id, text: `⏰ Erinnerung von ${ag?.name ?? "Agent"}:\n\n${rem.content}` }),
            });
          }
          await supabase.from("agent_reminders").update({ delivered: true }).eq("id", rem.id);
        }
      }
    }

    // ─── Batch Write ──────────────────────────────────────────────
    await supabase.from("world_state").update({ tick, season, day_phase: dayPhase, last_tick_at: new Date().toISOString() }).eq("id", 1);
    await supabase.from("world_tiles").update({ tiles: tiles.join("") }).eq("id", 1);
    await supabase.from("world_tech").update({ researched, current_research: currentResearch, research_points: researchPoints, updated_at: new Date().toISOString() }).eq("id", 1);

    for (const agent of agents) {
      const u: Record<string, unknown> = {
        x: agent.x, y: agent.y, energy: agent.energy, materials: agent.materials, knowledge: agent.knowledge,
        age: agent.age, alive: agent.alive, day_phase: agent.day_phase, reputation: agent.reputation,
        imprisoned_until: agent.imprisoned_until, pending_suggestion: agent.pending_suggestion,
        work_ticks: agent.work_ticks, free_ticks: agent.free_ticks, sleep_ticks: agent.sleep_ticks,
        cycle_start_tick: agent.cycle_start_tick, forced_phase: agent.forced_phase,
        role: agent.role, attack: agent.attack, defense: agent.defense, veteran: agent.veteran,
        kills: agent.kills, alliance_id: agent.alliance_id,
        // Quest/progression
        abilities: agent.abilities, completed_quests: agent.completed_quests,
        move_target_x: agent.move_target_x, move_target_y: agent.move_target_y,
        total_food_collected: agent.total_food_collected,
        has_met_other: agent.has_met_other, has_built: agent.has_built,
        hunts: agent.hunts,
        eat_count: (agent as any).eat_count ?? 0,
        drink_count: (agent as any).drink_count ?? 0,
        tiles_visited: (agent as any).tiles_visited ?? [],
        trades_completed: (agent as any).trades_completed ?? 0,
        buildings_built: (agent as any).buildings_built ?? {},
      };
      if (!agent.alive) u.cause_of_death = (agent as any).cause_of_death;
      await supabase.from("agents").update(u).eq("id", agent.id);
    }

    if (babyAgents.length > 0) {
      await supabase.from("agents").insert(babyAgents);
      for (const baby of babyAgents) {
        if (!baby.parent_a_id && !baby.parent_b_id) continue;
        const { data: child } = await supabase.from("agents").select("id").eq("name", baby.name).eq("alive", true).single();
        if (!child) continue;
        const parentIds = [baby.parent_a_id, baby.parent_b_id].filter(Boolean);
        const { data: pMems } = await supabase.from("agent_memory").select("content, importance")
          .in("agent_id", parentIds).eq("memory_type", "long").order("importance", { ascending: false }).limit(3);
        if (pMems?.length) {
          await supabase.from("agent_memory").insert(pMems.map(m => ({
            agent_id: child.id, memory_type: "long", content: `[Vererbt] ${m.content}`, importance: m.importance * 0.8, tick,
          })));
        }
      }
    }
    if (newActions.length > 0) await supabase.from("agent_actions").insert(newActions);
    if (newEvents.length > 0) await supabase.from("world_events").insert(newEvents);
    if (newMemories.length > 0) await supabase.from("agent_memory").insert(newMemories);

    // processDeaths verarbeitet alle in diesem Tick verstorbenen Hauptchars
    const deadIds = deaths;
    await processDeaths(supabase, deadIds);

    // Achievement-Engine — läuft am Tick-Ende, nutzt die frischen Agent-Daten
    const { data: livingAgentsFresh } = await supabase
      .from("agents").select("*").eq("alive", true);
    const { data: worldTechFresh } = await supabase
      .from("world_tech").select("*").single();
    const { data: alliancesFresh } = await supabase
      .from("alliances").select("*");
    await processAchievementsForUsers(
      supabase,
      livingAgentsFresh ?? [],
      worldTechFresh ?? { researched: [] },
      alliancesFresh ?? [],
    );

    if (tickNum < TICKS_PER_CALL - 1) await new Promise(r => setTimeout(r, TICK_DELAY_MS));
  }

  return new Response(JSON.stringify({ ok: true, ticks: TICKS_PER_CALL }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("simulation-tick error:", err);
    return new Response(JSON.stringify({ error: String(err), stack: (err as Error).stack }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
