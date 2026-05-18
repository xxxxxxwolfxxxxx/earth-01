-- Earth 0.1 — Initial Schema
-- Persistent AI agent simulation world

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  shared_llm_calls_today int not null default 0,
  shared_llm_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- WORLD STATE (singleton — exactly 1 row)
-- ============================================================
create table public.world_state (
  id int primary key default 1 check (id = 1),
  tick bigint not null default 0,
  season text not null default 'spring' check (season in ('spring', 'summer', 'autumn', 'winter')),
  day_phase text not null default 'work' check (day_phase in ('work', 'free', 'sleep')),
  grid_size int not null default 30,
  last_tick_at timestamptz not null default now()
);

alter table public.world_state enable row level security;

create policy "Anyone can read world state"
  on public.world_state for select using (true);

-- ============================================================
-- WORLD TILES (flat string, 1 char per tile)
-- ============================================================
create table public.world_tiles (
  id int primary key default 1 check (id = 1),
  tiles text not null default ''
);

alter table public.world_tiles enable row level security;

create policy "Anyone can read tiles"
  on public.world_tiles for select using (true);

-- ============================================================
-- AGENTS
-- ============================================================
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  x int not null default 0,
  y int not null default 0,
  energy real not null default 80,
  age int not null default 0,
  max_age int not null default 2400,
  alive boolean not null default true,
  cause_of_death text check (cause_of_death in (null, 'hunger', 'age', 'killed', 'disaster')),
  day_phase text not null default 'work' check (day_phase in ('work', 'free', 'sleep')),
  personality jsonb not null default '{"priority": 0.5, "social_mode": 0.5, "risk_tolerance": 0.5, "curiosity": 0.5, "cooperation": 0.5}',
  reputation real not null default 0 check (reputation >= -1 and reputation <= 1),
  imprisoned_until bigint,
  pending_suggestion jsonb,
  uses_own_llm boolean not null default false,
  generation int not null default 0,
  parent_a_id uuid references public.agents(id) on delete set null,
  parent_b_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_agents_alive on public.agents(alive) where alive = true;
create index idx_agents_owner on public.agents(owner_id);

alter table public.agents enable row level security;

create policy "Anyone can read agents"
  on public.agents for select using (true);

create policy "Owners insert own agents"
  on public.agents for insert with check (auth.uid() = owner_id);

create policy "Owners update own agents"
  on public.agents for update using (auth.uid() = owner_id);

-- ============================================================
-- AGENT MEMORY
-- ============================================================
create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  memory_type text not null check (memory_type in ('short', 'long')),
  content text not null,
  importance real not null default 0.5 check (importance >= 0 and importance <= 1),
  tick bigint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_memory_agent on public.agent_memory(agent_id);

alter table public.agent_memory enable row level security;

create policy "Owners read own agent memory"
  on public.agent_memory for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_memory.agent_id
        and agents.owner_id = auth.uid()
    )
  );

create policy "Owners insert own agent memory"
  on public.agent_memory for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_memory.agent_id
        and agents.owner_id = auth.uid()
    )
  );

-- ============================================================
-- AGENT ACTIONS (ring buffer — old entries cleaned by cron)
-- ============================================================
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  tick bigint not null,
  action_type text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index idx_actions_agent_tick on public.agent_actions(agent_id, tick desc);

alter table public.agent_actions enable row level security;

create policy "Anyone can read actions"
  on public.agent_actions for select using (true);

-- ============================================================
-- WORLD EVENTS
-- ============================================================
create table public.world_events (
  id uuid primary key default gen_random_uuid(),
  tick bigint not null,
  event_type text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index idx_events_tick on public.world_events(tick desc);

alter table public.world_events enable row level security;

create policy "Anyone can read events"
  on public.world_events for select using (true);

-- ============================================================
-- SEED: Initial world state + tiles
-- ============================================================
insert into public.world_state (tick, season, day_phase, grid_size)
values (0, 'spring', 'work', 30);

-- 30x30 grid = 900 tiles
-- Legend: e=empty, f=food, w=water, d=danger, t=tree
-- Start with ~15% food, ~5% water, ~3% trees, rest empty
-- Deterministic seed pattern
do $$
declare
  grid text := '';
  i int;
  r real;
  s bigint := 42;
begin
  for i in 1..900 loop
    s := (s * 16807) % 2147483647;
    r := s::real / 2147483647;
    if r < 0.15 then
      grid := grid || 'f';
    elsif r < 0.20 then
      grid := grid || 'w';
    elsif r < 0.23 then
      grid := grid || 't';
    else
      grid := grid || 'e';
    end if;
  end loop;
  insert into public.world_tiles (tiles) values (grid);
end;
$$;

-- ============================================================
-- REALTIME: Enable for live subscriptions
-- ============================================================
alter publication supabase_realtime add table public.world_state;
alter publication supabase_realtime add table public.world_tiles;
alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.world_events;
