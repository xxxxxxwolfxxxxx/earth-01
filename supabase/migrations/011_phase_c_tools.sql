-- 011_phase_c_tools.sql
-- Generisches user_lists Storage für Pattern-A-Tools
-- + Performance-Index auf agent_reminders.remind_at

CREATE TABLE IF NOT EXISTS public.user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (list_type IN ('shopping','family','symptom','diary','project'))
);

CREATE INDEX IF NOT EXISTS idx_user_lists_user_type
  ON public.user_lists(user_id, list_type, created_at DESC);

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_lists: owner reads" ON public.user_lists;
CREATE POLICY "user_lists: owner reads" ON public.user_lists
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: owner writes" ON public.user_lists;
CREATE POLICY "user_lists: owner writes" ON public.user_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: owner deletes" ON public.user_lists;
CREATE POLICY "user_lists: owner deletes" ON public.user_lists
  FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_lists: service all" ON public.user_lists;
CREATE POLICY "user_lists: service all" ON public.user_lists
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Performance-Index für reminder-tick-Worker (unfired reminders)
CREATE INDEX IF NOT EXISTS idx_agent_reminders_pending
  ON public.agent_reminders(remind_at ASC)
  WHERE delivered = false;
