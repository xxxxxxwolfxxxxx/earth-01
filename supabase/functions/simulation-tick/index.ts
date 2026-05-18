import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TICKS_PER_CALL = 10;
const TICK_DELAY_MS = 6000;
const DAY_LENGTH = 240;
const WORK_END = 80;
const FREE_END = 160;
const SEASON_LENGTH = 80;
const FOOD_SPAWN_INTERVAL = 5;
const DISASTER_INTERVAL = 40;

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

// Tile types: e=empty, f=food, w=water, d=danger, t=tree, b=building, s=shelter, p=prison, r=road, F=farm
const BUILD_COSTS: Record<string, { energy: number; from: string[] }> = {
  s: { energy: 20, from: ["e"] },       // shelter: protects from winter
  b: { energy: 25, from: ["e"] },       // building: general structure
  r: { energy: 10, from: ["e"] },       // road: faster movement
  F: { energy: 30, from: ["e", "f"] },  // farm: spawns food nearby
};

const FARM_SPAWN_RADIUS = 2;
const FARM_SPAWN_CHANCE = 0.15;
const MAX_POPULATION = 60;

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

function tileIdx(x: number, y: number, gridSize: number): number {
  return y * gridSize + x;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("SIMULATION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader !== `Bearer ${expectedKey}`) {
    // Also allow calls from pg_cron via service_role
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  for (let tickNum = 0; tickNum < TICKS_PER_CALL; tickNum++) {
    const { data: ws } = await supabase.from("world_state").select("*").single();
    if (!ws) break;

    const tick = ws.tick + 1;
    const gridSize = ws.grid_size;
    const season = getSeason(tick);
    const dayPhase = getDayPhase(tick);

    const { data: tilesRow } = await supabase.from("world_tiles").select("tiles").single();
    let tiles = (tilesRow?.tiles ?? "").split("");

    const { data: agentsData } = await supabase
      .from("agents")
      .select("*")
      .eq("alive", true);

    const agents: Agent[] = agentsData ?? [];
    const deaths: string[] = [];
    const newActions: { agent_id: string; tick: number; action_type: string; detail: Record<string, unknown> }[] = [];
    const newEvents: { tick: number; event_type: string; detail: Record<string, unknown> }[] = [];
    const babyAgents: Partial<Agent>[] = [];

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

        // Handle LLM build suggestions
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
        // Handle LLM move suggestions with road bonus
        if (action === "move" && detail.direction) {
          const dir = String(detail.direction);
          let dx = 0, dy = 0;
          if (dir === "north") dy = -1;
          else if (dir === "south") dy = 1;
          else if (dir === "east") dx = 1;
          else if (dir === "west") dx = -1;
          const onRoad = currentTileType === "r";
          const steps = onRoad ? 2 : 1;
          agent.x = Math.max(0, Math.min(gridSize - 1, agent.x + dx * steps));
          agent.y = Math.max(0, Math.min(gridSize - 1, agent.y + dy * steps));
          detail = { to: [agent.x, agent.y], road_bonus: onRoad };
        }
      } else {
        const currentTile = tiles[tileIdx(agent.x, agent.y, gridSize)];
        const nearTiles = neighbors(agent.x, agent.y, gridSize);

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

          // Build action: during work phase, agents with enough energy can build
          if (dayPhase === "work" && agent.energy > 50 && currentTileType === "e" && agent.personality.cooperation > 0.5) {
            // Choose what to build based on personality and surroundings
            const nearFoodCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "f").length;
            const nearShelterCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "s").length;
            const nearFarmCount = nearTiles.filter(([nx, ny]) => tiles[tileIdx(nx, ny, gridSize)] === "F").length;

            let buildType = "b";
            if (season === "autumn" && nearShelterCount === 0) {
              buildType = "s"; // build shelter before winter
            } else if (nearFoodCount < 2 && nearFarmCount === 0 && agent.personality.priority > 0.5) {
              buildType = "F"; // build farm if scarce food
            } else if (agent.personality.curiosity > 0.6) {
              buildType = "r"; // explorative agents build roads
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
              const nx = agent.x + Math.floor(Math.random() * 3) - 1;
              const ny = agent.y + Math.floor(Math.random() * 3) - 1;
              const clampedX = Math.max(0, Math.min(gridSize - 1, nx));
              const clampedY = Math.max(0, Math.min(gridSize - 1, ny));
              agent.x = clampedX;
              agent.y = clampedY;
              action = "explore";
              detail = { to: [clampedX, clampedY] };
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
              const emptyNear = nearTiles.filter(([nx, ny]) => {
                const t = tiles[tileIdx(nx, ny, gridSize)];
                return t === "e" || t === "f" || t === "w";
              });
              if (emptyNear.length > 0) {
                const [ex, ey] = emptyNear[Math.floor(Math.random() * emptyNear.length)];
                agent.x = ex;
                agent.y = ey;
                action = "wander";
                detail = { to: [ex, ey] };
              } else {
                action = "idle";
              }
            }
          }
        }
      }

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

    // Arrest mechanic: agents can arrest nearby agents with bad reputation
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
            newEvents.push({
              tick,
              event_type: "arrest",
              detail: { arrested: target.name, by: agent.name, until: tick + 100 },
            });
            newActions.push({
              agent_id: agent.id, tick, action_type: "arrest",
              detail: { target: target.name, reason: "low_reputation" },
            });
          }
        }
      }
    }

    // Communication: nearby agents exchange messages during free time
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
          tick,
          event_type: "communication",
          detail: { from: agent.name, to: partner.name, topic: agent.energy < 40 ? "hunger" : agent.reputation > 0.5 ? "cooperation" : "exploration" },
        });
      }
    }

    // Reproduction (only if below population cap, max 1 birth per tick)
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

        const spawnTiles = neighbors(a.x, a.y, gridSize).filter(
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
          x: cx,
          y: cy,
          energy: 50,
          max_age: 2000 + Math.floor(Math.random() * 800),
          personality: childPersonality as any,
          generation: gen,
          parent_a_id: a.id,
          parent_b_id: partner.id,
        });

        newEvents.push({
          tick,
          event_type: "birth",
          detail: { parent_a: a.name, parent_b: partner.name, child: childName },
        });
      }
    }

    // Food/water spawn
    if (tick % FOOD_SPAWN_INTERVAL === 0) {
      const rate = foodSpawnRate(season);
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] === "e" && Math.random() < rate) {
          tiles[i] = "f";
        }
      }
      // Farm bonus: farms spawn extra food nearby
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (tiles[tileIdx(x, y, gridSize)] === "F") {
            for (let dy = -FARM_SPAWN_RADIUS; dy <= FARM_SPAWN_RADIUS; dy++) {
              for (let dx = -FARM_SPAWN_RADIUS; dx <= FARM_SPAWN_RADIUS; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize) {
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

    // Disaster
    if (tick % DISASTER_INTERVAL === 0 && Math.random() < 0.3) {
      const cx = Math.floor(Math.random() * gridSize);
      const cy = Math.floor(Math.random() * gridSize);
      const radius = 2 + Math.floor(Math.random() * 3);
      let affected = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize) {
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
        newEvents.push({
          tick,
          event_type: "disaster",
          detail: { type: disasterType, center: [cx, cy], radius, tiles_destroyed: affected },
        });

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

    // Season change event
    if (tick % SEASON_LENGTH === 0) {
      newEvents.push({ tick, event_type: "season_change", detail: { season } });
    }

    // Batch write
    await supabase.from("world_state").update({
      tick,
      season,
      day_phase: dayPhase,
      last_tick_at: new Date().toISOString(),
    }).eq("id", 1);

    await supabase.from("world_tiles").update({ tiles: tiles.join("") }).eq("id", 1);

    for (const agent of agents) {
      const update: Record<string, unknown> = {
        x: agent.x,
        y: agent.y,
        energy: agent.energy,
        age: agent.age,
        alive: agent.alive,
        day_phase: agent.day_phase,
        reputation: agent.reputation,
        imprisoned_until: agent.imprisoned_until,
        pending_suggestion: agent.pending_suggestion,
      };
      if (!agent.alive) {
        update.cause_of_death = (agent as any).cause_of_death;
      }
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
