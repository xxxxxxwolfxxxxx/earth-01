-- 123_job_economy.sql
-- Phase 4: Job-Wirtschaft. Ersetzt die passive Donate-Mechanik.

-- ── Profil-Erweiterungen ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bot_at_work BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_credits NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jobs_done_total INT NOT NULL DEFAULT 0;

-- ── Community-Pool (Singleton) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_pool (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  credits_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_funded_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.community_pool (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.community_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read pool" ON public.community_pool;
CREATE POLICY "Public read pool" ON public.community_pool FOR SELECT USING (true);

-- ── Mammutaufgaben ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mammoth_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('website')),
  title TEXT NOT NULL,
  brief JSONB NOT NULL,
  credits_cost INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  progress INT NOT NULL DEFAULT 0,
  result_data JSONB,
  result_url TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mammoth_tasks_user_idx ON public.mammoth_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mammoth_tasks_status_idx ON public.mammoth_tasks(status);

ALTER TABLE public.mammoth_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own mammoth" ON public.mammoth_tasks;
CREATE POLICY "Own mammoth" ON public.mammoth_tasks
  FOR SELECT USING (auth.uid() = user_id);

-- ── article_jobs erweitern: Mammut-Link + Priorität ────────
ALTER TABLE public.article_jobs
  ADD COLUMN IF NOT EXISTS mammoth_task_id UUID REFERENCES public.mammoth_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS article_jobs_priority_idx
  ON public.article_jobs(priority DESC, created_at ASC);

-- job_type-CHECK erweitern um die 13 Mammoth-Website-Typen
ALTER TABLE public.article_jobs DROP CONSTRAINT IF EXISTS article_jobs_job_type_check;
ALTER TABLE public.article_jobs ADD CONSTRAINT article_jobs_job_type_check
  CHECK (job_type IN (
    'topic_propose','research','draft','illustrate','code_snippet','review','revise',
    'mammoth_brief','mammoth_design_concept','mammoth_section_hero','mammoth_section_about',
    'mammoth_section_services','mammoth_section_contact','mammoth_image_hero',
    'mammoth_image_secondary','mammoth_html_assemble','mammoth_css_styling',
    'mammoth_review_html','mammoth_revise','mammoth_package'
  ));

-- ── RPC: Atomare Credits-Buchung ───────────────────────────
CREATE OR REPLACE FUNCTION public.book_credits(
  p_user_id UUID,
  p_user_share NUMERIC,
  p_pool_share NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
    SET job_credits = job_credits + p_user_share,
        jobs_done_total = jobs_done_total + 1
    WHERE id = p_user_id;
  UPDATE public.community_pool
    SET credits_balance = credits_balance + p_pool_share,
        total_collected = total_collected + p_pool_share,
        updated_at = now()
    WHERE id = 1;
END $$;

-- ── RPC: Mammoth-Progress aktualisieren ────────────────────
CREATE OR REPLACE FUNCTION public.update_mammoth_progress(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INT;
  v_done INT;
  v_progress INT;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'done')
    INTO v_total, v_done
    FROM public.article_jobs WHERE mammoth_task_id = p_task_id;
  IF v_total = 0 THEN RETURN; END IF;
  v_progress := (v_done * 100) / v_total;
  UPDATE public.mammoth_tasks
    SET progress = v_progress,
        status = CASE WHEN v_done = v_total THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN v_done = v_total THEN now() ELSE completed_at END
    WHERE id = p_task_id;
END $$;

-- ── Storage-Bucket für Mammut-Ergebnisse ──────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('mammoth-results', 'mammoth-results', true)
  ON CONFLICT (id) DO NOTHING;

-- Public-Read auf den Bucket (alle, die die URL haben, dürfen runterladen)
DROP POLICY IF EXISTS "Public read mammoth" ON storage.objects;
CREATE POLICY "Public read mammoth" ON storage.objects
  FOR SELECT USING (bucket_id = 'mammoth-results');
