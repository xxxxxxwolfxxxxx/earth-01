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

const SEASONS = ["spring", "summer", "autumn", "winter"];

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

function energyCost(season: string): number {
  switch (season) {
    case "winter": return 0.4;
    case "autumn": return 0.25;
    default: return 0.2;
  }
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

      agent.energy -= energyCost(season);

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
          if (foodTiles.length > 0 && agent.energy < 60) {
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
              action = "socialize";
              const partner = nearAgents[Math.floor(Math.random() * nearAgents.length)];
              agent.reputation = Math.min(1, agent.reputation + 0.02);
              detail = { with: partner.name };
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

    // Reproduction
    if (tick % 20 === 0) {
      const fertile = agents.filter((a) => a.alive && a.energy > 65 && !a.imprisoned_until);
      const paired = new Set<string>();
      for (const a of fertile) {
        if (paired.has(a.id)) continue;
        const partner = fertile.find(
          (b) => b.id !== a.id && !paired.has(b.id) && Math.abs(b.x - a.x) <= 1 && Math.abs(b.y - a.y) <= 1 && b.reputation > -0.3
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

        babyAgents.push({
          owner_id: a.owner_id,
          name: `${a.name.slice(0, 10)}-Jr`,
          x: cx,
          y: cy,
          energy: 50,
          max_age: 2000 + Math.floor(Math.random() * 800),
          personality: childPersonality as any,
          generation: Math.max(a.generation, partner.generation) + 1,
          parent_a_id: a.id,
          parent_b_id: partner.id,
        });

        newEvents.push({
          tick,
          event_type: "birth",
          detail: { parent_a: a.name, parent_b: partner.name, child: `${a.name.slice(0, 10)}-Jr` },
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
