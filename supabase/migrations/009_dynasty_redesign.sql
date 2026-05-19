-- 009_dynasty_redesign.sql
-- Dynastie-Kern: Hauptchar-Zeiger, Achievement-Tabellen, Agent-Counter

-- profiles: Dynasty-Identität & optionale Tool-Keys
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_emoji TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_generation INT NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dynasty_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS groq_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resend_api_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS huggingface_key TEXT;

-- agents: Counter und Bio-Felder
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('m','f'));
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS eat_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS drink_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tiles_visited JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS trades_completed INT NOT NULL DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS display_name TEXT;
-- display_name: "Gisela 03" — wird beim Erbeübergang/Klon-Spawn gesetzt.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS buildings_built JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Achievement-Katalog (Seed in 010)
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 4),
  description TEXT NOT NULL,
  unlock_condition JSONB NOT NULL,
  tool_id TEXT NOT NULL,
  key_class TEXT NOT NULL CHECK (key_class IN ('builtin','extended')),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pro-User freigeschaltete Achievements
CREATE TABLE IF NOT EXISTS public.dynasty_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id),
  unlocked_by_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_dynasty_achievements_user ON public.dynasty_achievements(user_id);

-- Tool-Usage-Log (für Phase C — Rate-Limiting; jetzt nur Schema)
CREATE TABLE IF NOT EXISTS public.tool_usage_log (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, tool_id, date)
);

-- RLS-Policies
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements: everyone reads" ON public.achievements;
CREATE POLICY "achievements: everyone reads" ON public.achievements
  FOR SELECT USING (true);

ALTER TABLE public.dynasty_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dynasty_achievements: owner reads" ON public.dynasty_achievements;
CREATE POLICY "dynasty_achievements: owner reads" ON public.dynasty_achievements
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dynasty_achievements: service writes" ON public.dynasty_achievements;
CREATE POLICY "dynasty_achievements: service writes" ON public.dynasty_achievements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.tool_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_usage_log: owner reads" ON public.tool_usage_log;
CREATE POLICY "tool_usage_log: owner reads" ON public.tool_usage_log
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tool_usage_log: service writes" ON public.tool_usage_log;
CREATE POLICY "tool_usage_log: service writes" ON public.tool_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);