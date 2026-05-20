-- 100_platform_base.sql
-- Komplette Schema-Erneuerung für Tech-Tree-Plattform.
-- Droppt alle Tabellen aus Phase A/B/C der alten Welt.

-- ─── Cleanup alte Tabellen ────────────────────────────────
DROP TABLE IF EXISTS public.alliances CASCADE;
DROP TABLE IF EXISTS public.world_tech CASCADE;
DROP TABLE IF EXISTS public.world_events CASCADE;
DROP TABLE IF EXISTS public.agent_messages CASCADE;
DROP TABLE IF EXISTS public.agent_reminders CASCADE;
DROP TABLE IF EXISTS public.agent_memory CASCADE;
DROP TABLE IF EXISTS public.agent_actions CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.world_tiles CASCADE;
DROP TABLE IF EXISTS public.world_state CASCADE;
DROP TABLE IF EXISTS public.dynasty_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.tool_usage_log CASCADE;
DROP TABLE IF EXISTS public.user_lists CASCADE;

-- ─── profiles erweitern (Tabelle existiert aus initial_schema) ─
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS llm_api_key TEXT,
  ADD COLUMN IF NOT EXISTS llm_base_url TEXT,
  ADD COLUMN IF NOT EXISTS llm_model TEXT,
  ADD COLUMN IF NOT EXISTS groq_api_key TEXT,
  ADD COLUMN IF NOT EXISTS huggingface_key TEXT,
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS gdrive_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gdrive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS github_pat TEXT,
  ADD COLUMN IF NOT EXISTS github_repo TEXT,
  ADD COLUMN IF NOT EXISTS preferred_storage TEXT DEFAULT 'platform';

-- alte Spalten dropen (waren in Phase A/B/C)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS main_agent_id,
  DROP COLUMN IF EXISTS dynasty_name,
  DROP COLUMN IF EXISTS dynasty_emoji,
  DROP COLUMN IF EXISTS dynasty_generation,
  DROP COLUMN IF EXISTS dynasty_started_at,
  DROP COLUMN IF EXISTS shared_llm_calls_today,
  DROP COLUMN IF EXISTS shared_llm_reset_at;

-- ─── Skill-Katalog ────────────────────────────────────────
CREATE TABLE public.skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('hub','daten','sicherheit','tracking','llm','automation','cloud','spielerei')),
  skill_type TEXT NOT NULL CHECK (skill_type IN ('script','llm','workflow','config')),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('action','browser','konzept','konfig')),
  description TEXT NOT NULL,
  how_it_works TEXT NOT NULL,
  token_cost_estimate TEXT NOT NULL DEFAULT '0',
  requires JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  pattern TEXT,
  display_x INT NOT NULL,
  display_y INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_read_all" ON public.skills FOR SELECT USING (true);

-- ─── Glossar ──────────────────────────────────────────────
CREATE TABLE public.glossary (
  key TEXT PRIMARY KEY,
  icon TEXT,
  category TEXT NOT NULL,
  short_desc TEXT NOT NULL,
  example TEXT,
  related JSONB NOT NULL DEFAULT '[]'::jsonb,
  more_skill_id TEXT REFERENCES public.skills(id)
);

ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glossary_read_all" ON public.glossary FOR SELECT USING (true);

-- ─── Lesson-Sessions ──────────────────────────────────────
CREATE TABLE public.lesson_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES public.skills(id),
  state TEXT NOT NULL DEFAULT 'concept' CHECK (state IN ('concept','task','verified','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_lesson_sessions_user_skill ON public.lesson_sessions(user_id, skill_id, state);
CREATE INDEX idx_lesson_sessions_open ON public.lesson_sessions(user_id) WHERE state = 'task';

ALTER TABLE public.lesson_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_owner_select" ON public.lesson_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lesson_owner_insert" ON public.lesson_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lesson_owner_update" ON public.lesson_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lesson_service_all" ON public.lesson_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── User-Skills ──────────────────────────────────────────
CREATE TABLE public.user_skills (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES public.skills(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_skills_owner_select" ON public.user_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_skills_service_all" ON public.user_skills FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Skill-Nutzungs-Log ───────────────────────────────────
CREATE TABLE public.skill_usage_log (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 1,
  tokens_consumed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, skill_id, date)
);

ALTER TABLE public.skill_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_log_owner_select" ON public.skill_usage_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usage_log_service_all" ON public.skill_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── User-Storage ─────────────────────────────────────────
CREATE TABLE public.user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, namespace, key)
);

CREATE INDEX idx_user_data_ns ON public.user_data(user_id, namespace, created_at DESC);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_data_owner_all" ON public.user_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_data_service_all" ON public.user_data FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Reminders ────────────────────────────────────────────
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  source_skill TEXT NOT NULL DEFAULT 'reminder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_pending ON public.reminders(remind_at) WHERE delivered = false;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_owner_all" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_service_all" ON public.reminders FOR ALL TO service_role USING (true) WITH CHECK (true);
