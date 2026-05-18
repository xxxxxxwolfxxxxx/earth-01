import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TICKS_PER_CALL = 10;
const TICK_DELAY_MS = 6000;
const DAY_LENGTH = 240;
const WORK_END = 80;
const FREE_END = 160;
const SEASON_LENGTH = 80;
const FOOD_SPAWN_INTERVAL = 5;
const DISASTER_INTERVAL = 40;
const MAX_POPULATION = 60;
const FARM_SPAWN_RADIUS = 2;
const FARM_SPAWN_CHANCE = 0.15;

// 30x30 land mask: L=land, o=ocean. Maps to lat 80°N..80°S, lng 160°W..160°E
// Continents: NA=North America, SA=South America, EU=Europe, AF=Africa, AS=Asia, AU=Australia
const LAND_MASK = [
  "oooooooooooooooooooooooooooooo", // 0  Arctic
  "oLLoooooooooooooooLLLLLLLooooo", // 1  Alaska, Siberia
  "oLLLooooooooooLLoLLLLLLLLooooo", // 2  W.Canada, Iceland, Russia
  "oLLLLoooooooooLLLLLLLLLLLLoooo", // 3  Canada, Scandinavia, Russia
  "ooLLLLLooooooLLLLLLLLLLLLLoooo", // 4  S.Canada, UK/Europe, Russia
  "ooLLLLLooooooLLLLLLLLLLLLLoooo", // 5  US/Canada, W.Europe, Russia
  "ooLLLLLooooooLLLLLLLLLLLLooooo", // 6  US, Med, Central Asia, China
  "oooLLLLooooooLLLLLLLLLLLLooooo", // 7  US, N.Africa, Middle East, China
  "oooLLLLooooooLLLLLLLLLLLLooooo", // 8  S.US, Sahara, India, China
  "ooooLLLooooooLLLLLoLLLLLLooooo", // 9  Mexico, W.Africa, India, SE Asia
  "oooooLLooooooLLLLLoLLLLLoooooo", // 10 C.America, Africa, India
  "oooooLLoooooLLLLLLoLLLLLooooo",  // 11 FIXME
  "ooooooLLooooLLLLLLoooLLLoooooo", // 12 N.S.America, W.Africa, SE Asia
  "ooooooLLLooLLLLLLLoooooLoooooo", // 13 S.America, C.Africa, Indonesia
  "oooooooLLLoLLLLLLooooooooooLoo", // 14 Brazil, Africa, PNG
  "oooooooLLLoooLLLLooooooooLLLoo", // 15 Brazil, E.Africa, N.Australia
  "ooooooooLLooooLLLLoooooLLLLLoo", // 16 Brazil, E.Africa, Australia
  "ooooooooLLooooLLLooooooLLLLLoo", // 17 S.Brazil, SE.Africa, Australia
  "oooooooooLLoooooLLooooLLLLLLoo", // 18 Argentina, S.Africa, Australia
  "oooooooooLLoooooLLoooooLLLLLoo", // 19 Argentina, S.Africa, Australia
  "ooooooooLLooooooLooooooooLLLoo", // 20 Argentina, S.Africa tip, SE Aus
  "ooooooooLLoooooooooooooooooooo", // 21 Patagonia
  "oooooooooLoooooooooooooooooooo", // 22 Patagonia tip
  "oooooooooooooooooooooooooooooo", // 23
  "oooooooooooooooooooooooooooooo", // 24
  "oooooooooooooooooooooooooooooo", // 25
  "oooooooooooooooooooooooooooooo", // 26
  "oooooooooooooooooooooooooooooo", // 27
  "oooooooooooooooooooooooooooooo", // 28
  "oooooooooooooooooooooooooooooo", // 29
];

// Fix row 11 to 30 chars
const LAND_MASK_FIXED = LAND_MASK.map(row => row.length < 30 ? row + "o".repeat(30 - row.length) : row.slice(0, 30));

function isLand(x: number, y: number): boolean {
  if (y < 0 || y >= 30 || x < 0 || x >= 30) return false;
  return LAND_MASK_FIXED[y][x] === "L";
}

// Continent regions for initial population seeding
const CONTINENTS: Record<string, { name: string; cells: [number, number][] }> = {};
function initContinents() {
  const regions: { name: string; xMin: number; xMax: number; yMin: number; yMax: number }[] = [
    { name: "Nordamerika", xMin: 1, xMax: 7, yMin: 1, yMax: 10 },
    { name: "Südamerika", xMin: 6, xMax: 10, yMin: 12, yMax: 22 },
    { name: "Europa", xMin: 13, xMax: 17, yMin: 2, yMax: 7 },
    { name: "Afrika", xMin: 12, xMax: 18, yMin: 7, yMax: 20 },
    { name: "Asien", xMin: 17, xMax: 27, yMin: 1, yMax: 12 },
    { name: "Australien", xMin: 22, xMax: 28, yMin: 15, yMax: 20 },
  ];
  for (const r of regions) {
    const cells: [number, number][] = [];
    for (let y = r.yMin; y <= r.yMax; y++) {
      for (let x = r.xMin; x <= r.xMax; x++) {
        if (isLand(x, y)) cells.push([x, y]);
      }
    }
    if (cells.length > 0) CONTINENTS[r.name] = { name: r.name, cells };
  }
}
initContinents();

type Agent = {
  id: string;
  name: string;
  x: number;
  y: number;
  energy: number;
  age: number;
  max_age: number;
  alive: boolean;
  day_phase: string;
  personality: Record<string, number>;
  reputation: number;
  imprisoned_until: number | null;
  pending_suggestion: Record<string, unknown> | null;
  generation: number;
  parent_a_id: string | null;
  parent_b_id: string | null;
  owner_id: string;
};

const CHILD_NAMES = [
  "Aria", "Bolt", "Cora", "Dex", "Elia", "Finn", "Gaia", "Hex", "Iris", "Juno",
  "Kai", "Luna", "Milo", "Nova", "Onyx", "Pax", "Quill", "Rex", "Sol", "Tara",
  "Uma", "Vex", "Wren", "Xara", "Yuki", "Zara", "Aero", "Blaze", "Cyra", "Dusk",
  "Echo", "Flux", "Glyph", "Haze", "Ion", "Jett", "Kira", "Lux", "Moss", "Nyx",
];

const SEASONS = ["spring", "summer", "autumn", "winter"];

const BUILD_COSTS: Record<string, { energy: number; from: string[] }> = {
  s: { energy: 20, from: ["e"] },
  b: { energy: 25, from: ["e"] },
  r: { energy: 10, from: ["e"] },
  F: { energy: 30, from: ["e", "f"] },
  P: { energy: 40, from: ["e"] }, // port: allows ocean crossing
};

function getDayPhase(tick: number): string {
  const phase = tick % DAY_LENGTH;
  if (phase < WORK_END) return "work";
  if (phase < FREE_END) return "free";
  return "sleep";
}

function getSeason(tick: number): string {
  const idx = Math.floor((tick / SEASON_LENGTH) % 4);
  return SEASONS[idx];
}

function energyCost(season: string, onShelter: boolean): number {
  const base = season === "winter" ? 0.4 : season === "autumn" ? 0.25 : 0.2;
  return onShelter && season === "winter" ? base * 0.5 : base;
}

function foodSpawnRate(season: string): number {
  switch (season) {
    case "spring": return 0.06;
    case "summer": return 0.08;
    case "autumn": return 0.04;
    case "winter": return 0.02;
    default: return 0.04;
  }
}

function neighbors(x: number, y: number, gridSize: number): [number, number][] {
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  return dirs
    .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize);
}

function landNeighbors(x: number, y: number, gridSize: number): [number, number][] {
  return neighbors(x, y, gridSize).filter(([nx, ny]) => isLand(nx, ny));
}

function tileIdx(x: number, y: number, gridSize: number): number {
  return y * gridSize + x;
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Handle reset parameter
  const url = new URL(req.url);
  if (url.searchParams.get("reset") === "true") {
    await supabase.from("agents").update({ alive: false, energy: 0, cause_of_death: "world_reset" }).eq("alive", true);
    return new Response(JSON.stringify({ ok: true, action: "reset" }), { headers: { "Content-Type": "application/json" } });
  }

  for (let tickNum = 0; tickNum < TICKS_PER_CALL; tickNum++) {
    const { data: ws } = await supabase.from("world_state").select("*").single();
    if (!ws) break;

    const tick = ws.tick + 1;
    const gridSize = ws.grid_size;
    const season = getSeason(tick);
    const dayPhase = getDayPhase(tick);

    const { data: tilesRow } = await supabase.from("world_tiles").select("tiles").single();
    let tiles = (tilesRow?.tiles ?? "").split("");

    // Enforce land mask: set ocean cells to 'o', land cells keep their type
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = tileIdx(x, y, gridSize);
        if (!isLand(x, y)) {
          tiles[idx] = "o";
        }
      }
    }

    const { data: agentsData } = await supabase
      .from("agents")
      .select("*")
      .eq("alive", true);

    let agents: Agent[] = agentsData ?? [];

    // Auto-seed: if no living agents, create starter populations on each continent
    if (agents.length === 0) {
      const SEED_CONTINENTS: { name: string; cells: [number, number][]; names: string[]; personality: Record<string, number> }[] = [
        { name: "Nordamerika", cells: [[3,5],[4,5],[5,5],[4,6],[5,6]], names: ["Eagle","River","Storm","Cedar","Hawk"], personality: {priority:0.6,social_mode:0.5,risk_tolerance:0.7,curiosity:0.8,cooperation:0.5} },
        { name: "Südamerika", cells: [[8,14],[9,14],[8,15],[9,15],[8,16]], names: ["Sol","Luna","Rio","Flora","Tierra"], personality: {priority:0.5,social_mode:0.7,risk_tolerance:0.5,curiosity:0.6,cooperation:0.7} },
        { name: "Europa", cells: [[14,4],[15,4],[14,5],[15,5],[16,5]], names: ["Atlas","Lyra","Orion","Nova","Vega"], personality: {priority:0.7,social_mode:0.6,risk_tolerance:0.4,curiosity:0.7,cooperation:0.6} },
        { name: "Afrika", cells: [[14,10],[15,10],[14,11],[15,11],[16,12]], names: ["Zola","Amara","Kofi","Nia","Jabari"], personality: {priority:0.5,social_mode:0.8,risk_tolerance:0.5,curiosity:0.5,cooperation:0.8} },
        { name: "Asien", cells: [[21,6],[22,6],[23,6],[21,7],[22,7]], names: ["Kai","Yuki","Lin","Haru","Ming"], personality: {priority:0.8,social_mode:0.5,risk_tolerance:0.3,curiosity:0.6,cooperation:0.7} },
        { name: "Australien", cells: [[24,17],[25,17],[26,17],[24,18],[25,18]], names: ["Reef","Dune","Opal","Wren","Blaze"], personality: {priority:0.4,social_mode:0.6,risk_tolerance:0.8,curiosity:0.9,cooperation:0.5} },
      ];

      // Get any owner_id from profiles
      const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
      const ownerId = profiles?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";

      const seedAgents: Partial<Agent>[] = [];
      for (const cont of SEED_CONTINENTS) {
        for (let i = 0; i < cont.cells.length; i++) {
          const [x, y] = cont.cells[i];
          if (!isLand(x, y)) continue;
          const p: Record<string, number> = {};
          for (const [k, v] of Object.entries(cont.personality)) {
            p[k] = Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.2));
          }
          seedAgents.push({
            owner_id: ownerId,
            name: cont.names[i],
            x, y,
            energy: 80,
            max_age: 2000 + Math.floor(Math.random() * 800),
            personality: p as any,
            generation: 0,
          });
        }
      }

      if (seedAgents.length > 0) {
        await supabase.from("agents").insert(seedAgents);
        // Reload agents
        const { data: reloaded } = await supabase.from("agents").select("*").eq("alive", true);
        agents = reloaded ?? [];
      }
    }

    const deaths: string[] = [];
    const newActions: { agent_id: string; tick: number; action_type: string; detail: Record<string, unknown> }[] = [];
    const newEvents: { tick: number; event_type: string; detail: Record<string, unknown> }[] = [];
    const babyAgents: Partial<Agent>[] = [];

    // Move agents stuck in ocean to nearest land
    for (const agent of agents) {
      if (!agent.alive) continue;
      if (!isLand(agent.x, agent.y)) {
        const landCells: [number, number][] = [];
        for (let r = 1; r < 10; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) === r || Math.abs(dy) === r) {
                const nx = agent.x + dx, ny = agent.y + dy;
                if (isLand(nx, ny)) landCells.push([nx, ny]);
              }
            }
          }
          if (landCells.length > 0) break;
        }
        if (landCells.length > 0) {
          const [nx, ny] = landCells[Math.floor(Math.random() * landCells.length)];
          agent.x = nx;
          agent.y = ny;
        }
      }
    }

    const posMap = new Map<string, Agent[]>();
    for (const a of agents) {
      const key = `${a.x},${a.y}`;
      if (!posMap.has(key)) posMap.set(key, []);
      posMap.get(key)!.push(a);
    }

    for (const agent of agents) {
      if (!agent.alive) continue;

      agent.age += 1;

      if (agent.age >= agent.max_age) {
        agent.alive = false;
        agent.energy = 0;
        (agent as any).cause_of_death = "age";
        deaths.push(agent.id);
        newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "age", age: agent.age } });
        continue;
      }

      const imprisoned = agent.imprisoned_until && tick < agent.imprisoned_until;
      if (imprisoned) {
        agent.energy -= 0.3;
        if (agent.energy <= 0) {
          agent.alive = false;
          agent.energy = 0;
          (agent as any).cause_of_death = "hunger";
          deaths.push(agent.id);
          newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "hunger_in_prison" } });
        }
        continue;
      }
      if (agent.imprisoned_until && tick >= agent.imprisoned_until) {
        agent.imprisoned_until = null;
      }

      agent.day_phase = dayPhase;

      if (dayPhase === "sleep") {
        agent.energy = Math.min(100, agent.energy + 0.5);
        continue;
      }

      const currentTileType = tiles[tileIdx(agent.x, agent.y, gridSize)];
      const onShelter = currentTileType === "s";
      const aliveNow = agents.filter(a => a.alive).length;
      const populationPressure = aliveNow > MAX_POPULATION
        ? 0.3 + (aliveNow - MAX_POPULATION) * 0.05
        : 0;
      agent.energy -= energyCost(season, onShelter) + populationPressure;

      if (agent.energy <= 0) {
        agent.alive = false;
        agent.energy = 0;
        (agent as any).cause_of_death = "hunger";
        deaths.push(agent.id);
        newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "hunger" } });
        continue;
      }

      const suggestion = agent.pending_suggestion;
      agent.pending_suggestion = null;
      let action = "idle";
      let detail: Record<string, unknown> = {};

      if (suggestion && typeof suggestion === "object" && "action" in suggestion) {
        action = String(suggestion.action);
        detail = suggestion as Record<string, unknown>;

        if (action === "build" || action === "farm") {
          const buildType = action === "farm" ? "F" : (String(detail.type || "b"));
          const validType = BUILD_COSTS[buildType];
          const currTile = tiles[tileIdx(agent.x, agent.y, gridSize)];
          if (validType && validType.from.includes(currTile) && agent.energy > validType.energy + 10) {
            agent.energy -= validType.energy;
            tiles[tileIdx(agent.x, agent.y, gridSize)] = buildType;
            agent.reputation = Math.min(1, agent.reputation + 0.02);
            detail = { built: buildType, at: [agent.x, agent.y] };
            newEvents.push({ tick, event_type: "build", detail: { builder: agent.name, type: buildType, at: [agent.x, agent.y] } });
          } else {
            action = "idle";
            detail = { reason: "cannot_build_here" };
          }
        }
        if (action === "move" && detail.direction) {
          const dir = String(detail.direction);
          let dx = 0, dy = 0;
          if (dir === "north") dy = -1;
          else if (dir === "south") dy = 1;
          else if (dir === "east") dx = 1;
          else if (dir === "west") dx = -1;
          const onRoad = currentTileType === "r";
          const steps = onRoad ? 2 : 1;
          const newX = Math.max(0, Math.min(gridSize - 1, agent.x + dx * steps));
          const newY = Math.max(0, Math.min(gridSize - 1, agent.y + dy * steps));
          // Only move if target is land (or agent has port nearby for ocean crossing)
          if (isLand(newX, newY)) {
            agent.x = newX;
            agent.y = newY;
            detail = { to: [agent.x, agent.y], road_bonus: onRoad };
          } else {
            // Check for port-based ocean crossing
            const hasPort = neighbors(agent.x, agent.y, gridSize).some(
              ([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "P"
            );
            if (hasPort) {
              // Find nearest land in that direction
              for (let dist = 2; dist <= 8; dist++) {
                const tx = Math.max(0, Math.min(gridSize - 1, agent.x + dx * dist));
                const ty = Math.max(0, Math.min(gridSize - 1, agent.y + dy * dist));
                if (isLand(tx, ty)) {
                  agent.x = tx;
                  agent.y = ty;
                  agent.energy -= 5; // ocean crossing costs extra energy
                  detail = { to: [agent.x, agent.y], ocean_crossing: true };
                  newEvents.push({ tick, event_type: "voyage", detail: { agent: agent.name, from_port: true, to: [tx, ty] } });
                  break;
                }
              }
            }
          }
        }
      } else {
        const currentTile = tiles[tileIdx(agent.x, agent.y, gridSize)];
        const nearTiles = landNeighbors(agent.x, agent.y, gridSize);

        if (currentTile === "f") {
          action = "eat";
          agent.energy = Math.min(100, agent.energy + 15);
          tiles[tileIdx(agent.x, agent.y, gridSize)] = "e";
          detail = { gained: 15 };
        } else if (currentTile === "w") {
          action = "drink";
          agent.energy = Math.min(100, agent.energy + 5);
          detail = { gained: 5 };
        } else {
          const foodTiles = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "f");

          if (dayPhase === "work" && agent.energy > 50 && currentTileType === "e" && agent.personality.cooperation > 0.5) {
            const nearFoodCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "f").length;
            const nearShelterCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "s").length;
            const nearFarmCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "F").length;

            let buildType = "b";
            if (season === "autumn" && nearShelterCount === 0) {
              buildType = "s";
            } else if (nearFoodCount < 2 && nearFarmCount === 0 && agent.personality.priority > 0.5) {
              buildType = "F";
            } else if (agent.personality.curiosity > 0.6) {
              buildType = "r";
            }

            const cost = BUILD_COSTS[buildType]?.energy ?? 20;
            if (agent.energy > cost + 20) {
              agent.energy -= cost;
              tiles[tileIdx(agent.x, agent.y, gridSize)] = buildType;
              action = "build";
              detail = { built: buildType, at: [agent.x, agent.y] };
              agent.reputation = Math.min(1, agent.reputation + 0.02);
              newEvents.push({ tick, event_type: "build", detail: { builder: agent.name, type: buildType, at: [agent.x, agent.y] } });
            }
          } else if (foodTiles.length > 0 && agent.energy < 60) {
            const [fx, fy] = foodTiles[Math.floor(Math.random() * foodTiles.length)];
            agent.x = fx;
            agent.y = fy;
            action = "move_to_food";
            detail = { to: [fx, fy] };
          } else if (dayPhase === "free") {
            const nearAgents = agents.filter(
              (other) => other.id !== agent.id && other.alive && Math.abs(other.x - agent.x) <= 2 && Math.abs(other.y - agent.y) <= 2
            );
            if (nearAgents.length > 0 && agent.personality.social_mode > 0.4) {
              const goodPartners = nearAgents.filter((a) => a.reputation >= -0.2);
              const partner = goodPartners.length > 0
                ? goodPartners[Math.floor(Math.random() * goodPartners.length)]
                : null;
              if (partner) {
                action = "socialize";
                agent.reputation = Math.min(1, agent.reputation + 0.02);
                partner.reputation = Math.min(1, partner.reputation + 0.01);
                detail = { with: partner.name };
              } else {
                action = "avoid";
                detail = { reason: "no_trustworthy_neighbors" };
              }
            } else if (nearAgents.length > 0 && agent.personality.cooperation < 0.3 && agent.energy < 40) {
              const victim = nearAgents.find((a) => a.energy > 30);
              if (victim) {
                const stolen = Math.min(10, victim.energy - 10);
                if (stolen > 0) {
                  agent.energy = Math.min(100, agent.energy + stolen);
                  victim.energy -= stolen;
                  agent.reputation = Math.max(-1, agent.reputation - 0.15);
                  action = "steal";
                  detail = { from: victim.name, amount: stolen };
                  newEvents.push({ tick, event_type: "crime", detail: { thief: agent.name, victim: victim.name, amount: stolen } });
                }
              }
            } else {
              // Wander: only to land neighbors
              const walkable = landNeighbors(agent.x, agent.y, gridSize);
              if (walkable.length > 0) {
                const [nx, ny] = walkable[Math.floor(Math.random() * walkable.length)];
                // Road bonus: if on road, try to move 2 steps
                if (currentTileType === "r") {
                  const further = landNeighbors(nx, ny, gridSize)
                    .filter(([fx, fy]) => fx !== agent.x || fy !== agent.y);
                  if (further.length > 0) {
                    const [fx, fy] = further[Math.floor(Math.random() * further.length)];
                    agent.x = fx;
                    agent.y = fy;
                  } else {
                    agent.x = nx;
                    agent.y = ny;
                  }
                } else {
                  agent.x = nx;
                  agent.y = ny;
                }
                action = "explore";
                detail = { to: [agent.x, agent.y] };
              }
            }
          } else {
            const waterTiles = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "w");
            if (waterTiles.length > 0) {
              const [wx, wy] = waterTiles[0];
              agent.x = wx;
              agent.y = wy;
              action = "move_to_water";
              detail = { to: [wx, wy] };
            } else {
              const walkable = nearTiles.filter(([nx, ny]) => {
                const t = tiles[tileIdx(nx, ny, gridSize)];
                return t !== "o" && t !== "d";
              });
              if (walkable.length > 0) {
                const [ex, ey] = walkable[Math.floor(Math.random() * walkable.length)];
                agent.x = ex;
                agent.y = ey;
                action = "wander";
                detail = { to: [ex, ey] };
              }
            }
          }
        }
      }

      // Energy sharing
      if (dayPhase === "free" && agent.energy > 30) {
        const nearAgents = agents.filter(
          (other) => other.id !== agent.id && other.alive && other.energy < 20 && Math.abs(other.x - agent.x) <= 1 && Math.abs(other.y - agent.y) <= 1
        );
        if (nearAgents.length > 0 && agent.personality.cooperation > 0.6) {
          const recipient = nearAgents[0];
          const share = Math.min(10, agent.energy - 20);
          if (share > 0) {
            agent.energy -= share;
            recipient.energy += share;
            agent.reputation = Math.min(1, agent.reputation + 0.05);
            newActions.push({ agent_id: agent.id, tick, action_type: "share_energy", detail: { to: recipient.name, amount: share } });
          }
        }
      }

      newActions.push({ agent_id: agent.id, tick, action_type: action, detail });
    }

    // Arrest mechanic
    if (dayPhase === "work" || dayPhase === "free") {
      for (const agent of agents) {
        if (!agent.alive || agent.imprisoned_until) continue;
        const nearAgents = agents.filter(
          (other) => other.id !== agent.id && other.alive && !other.imprisoned_until
            && Math.abs(other.x - agent.x) <= 1 && Math.abs(other.y - agent.y) <= 1
        );
        for (const target of nearAgents) {
          if (target.reputation >= -0.2) continue;
          const witnesses = nearAgents.filter((w) => w.id !== target.id && w.reputation > 0);
          if (witnesses.length >= 1 && agent.reputation > 0) {
            target.imprisoned_until = tick + 100;
            target.reputation = Math.max(-1, target.reputation - 0.1);
            agent.reputation = Math.min(1, agent.reputation + 0.03);
            newEvents.push({ tick, event_type: "arrest", detail: { arrested: target.name, by: agent.name, until: tick + 100 } });
          }
        }
      }
    }

    // Communication
    if (dayPhase === "free" && tick % 5 === 0) {
      for (const agent of agents) {
        if (!agent.alive || agent.imprisoned_until) continue;
        if (agent.personality.social_mode < 0.5) continue;
        const nearAgents = agents.filter(
          (other) => other.id !== agent.id && other.alive && !other.imprisoned_until
            && Math.abs(other.x - agent.x) <= 2 && Math.abs(other.y - agent.y) <= 2
        );
        if (nearAgents.length === 0) continue;
        const partner = nearAgents[Math.floor(Math.random() * nearAgents.length)];
        newEvents.push({
          tick, event_type: "communication",
          detail: { from: agent.name, to: partner.name, topic: agent.energy < 40 ? "hunger" : agent.reputation > 0.5 ? "cooperation" : "exploration" },
        });
      }
    }

    // Reproduction (max 1 per tick, only on land)
    const aliveCount = agents.filter((a) => a.alive).length + babyAgents.length;
    if (tick % 80 === 0 && aliveCount < MAX_POPULATION && babyAgents.length === 0) {
      const fertile = agents.filter((a) => a.alive && a.energy > 65 && !a.imprisoned_until);
      const paired = new Set<string>();
      for (const a of fertile) {
        if (paired.has(a.id) || babyAgents.length >= 1) continue;
        const partner = fertile.find(
          (b) => b.id !== a.id && !paired.has(b.id) && Math.abs(b.x - a.x) <= 1 && Math.abs(b.y - a.y) <= 1
            && b.reputation > -0.3 && a.reputation > -0.3
        );
        if (!partner) continue;
        paired.add(a.id);
        paired.add(partner.id);

        a.energy -= 20;
        partner.energy -= 20;

        const childPersonality: Record<string, number> = {};
        for (const key of ["priority", "social_mode", "risk_tolerance", "curiosity", "cooperation"]) {
          const avg = (a.personality[key] + partner.personality[key]) / 2;
          const mutation = (Math.random() - 0.5) * 0.2;
          childPersonality[key] = Math.max(0, Math.min(1, avg + mutation));
        }

        // Spawn on nearby land tile
        const spawnTiles = landNeighbors(a.x, a.y, gridSize).filter(
          ([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] !== "d"
        );
        const [cx, cy] = spawnTiles.length > 0
          ? spawnTiles[Math.floor(Math.random() * spawnTiles.length)]
          : [a.x, a.y];

        const gen = Math.max(a.generation, partner.generation) + 1;
        const childName = CHILD_NAMES[Math.floor(Math.random() * CHILD_NAMES.length)] + "-" + gen;

        babyAgents.push({
          owner_id: a.owner_id,
          name: childName,
          x: cx, y: cy,
          energy: 50,
          max_age: 2000 + Math.floor(Math.random() * 800),
          personality: childPersonality as any,
          generation: gen,
          parent_a_id: a.id,
          parent_b_id: partner.id,
        });

        newEvents.push({
          tick, event_type: "birth",
          detail: { parent_a: a.name, parent_b: partner.name, child: childName },
        });
      }
    }

    // Food/water spawn (only on land)
    if (tick % FOOD_SPAWN_INTERVAL === 0) {
      const rate = foodSpawnRate(season);
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const idx = tileIdx(x, y, gridSize);
          if (!isLand(x, y)) continue;
          if (tiles[idx] === "e" && Math.random() < rate) {
            tiles[idx] = "f";
          }
        }
      }
      // Farm bonus
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (tiles[tileIdx(x, y, gridSize)] === "F") {
            for (let dy = -FARM_SPAWN_RADIUS; dy <= FARM_SPAWN_RADIUS; dy++) {
              for (let dx = -FARM_SPAWN_RADIUS; dx <= FARM_SPAWN_RADIUS; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize && isLand(nx, ny)) {
                  const idx = tileIdx(nx, ny, gridSize);
                  if (tiles[idx] === "e" && Math.random() < FARM_SPAWN_CHANCE) {
                    tiles[idx] = "f";
                  }
                }
              }
            }
          }
        }
      }
    }

    // Disasters (only on land)
    if (tick % DISASTER_INTERVAL === 0 && Math.random() < 0.3) {
      // Pick a random land cell
      const landCells: [number, number][] = [];
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (isLand(x, y)) landCells.push([x, y]);
        }
      }
      if (landCells.length > 0) {
        const [cx, cy] = landCells[Math.floor(Math.random() * landCells.length)];
        const radius = 2 + Math.floor(Math.random() * 2);
        let affected = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize && isLand(nx, ny)) {
              const idx = tileIdx(nx, ny, gridSize);
              if (tiles[idx] === "f" || tiles[idx] === "t") {
                tiles[idx] = "e";
                affected++;
              }
            }
          }
        }
        if (affected > 0) {
          const disasterType = season === "winter" ? "blizzard" : season === "summer" ? "drought" : "storm";
          newEvents.push({ tick, event_type: "disaster", detail: { type: disasterType, center: [cx, cy], radius, tiles_destroyed: affected } });

          for (const agent of agents) {
            if (agent.alive && Math.abs(agent.x - cx) <= radius && Math.abs(agent.y - cy) <= radius) {
              const damage = 10 + Math.random() * 15;
              agent.energy -= damage;
              if (agent.energy <= 0) {
                agent.alive = false;
                agent.energy = 0;
                (agent as any).cause_of_death = "disaster";
                deaths.push(agent.id);
                newEvents.push({ tick, event_type: "death", detail: { agent_id: agent.id, name: agent.name, cause: "disaster" } });
              }
            }
          }
        }
      }
    }

    if (tick % SEASON_LENGTH === 0) {
      newEvents.push({ tick, event_type: "season_change", detail: { season } });
    }

    // Batch write
    await supabase.from("world_state").update({
      tick, season, day_phase: dayPhase, last_tick_at: new Date().toISOString(),
    }).eq("id", 1);

    await supabase.from("world_tiles").update({ tiles: tiles.join("") }).eq("id", 1);

    for (const agent of agents) {
      const update: Record<string, unknown> = {
        x: agent.x, y: agent.y, energy: agent.energy, age: agent.age,
        alive: agent.alive, day_phase: agent.day_phase, reputation: agent.reputation,
        imprisoned_until: agent.imprisoned_until, pending_suggestion: agent.pending_suggestion,
      };
      if (!agent.alive) update.cause_of_death = (agent as any).cause_of_death;
      await supabase.from("agents").update(update).eq("id", agent.id);
    }

    if (babyAgents.length > 0) {
      await supabase.from("agents").insert(babyAgents);
    }
    if (newActions.length > 0) {
      await supabase.from("agent_actions").insert(newActions);
    }
    if (newEvents.length > 0) {
      await supabase.from("world_events").insert(newEvents);
    }

    if (tickNum < TICKS_PER_CALL - 1) {
      await new Promise((r) => setTimeout(r, TICK_DELAY_MS));
    }
  }

  return new Response(JSON.stringify({ ok: true, ticks: TICKS_PER_CALL }), {
    headers: { "Content-Type": "application/json" },
  });
});
