-- 120_swarm_schema.sql

-- Themen-Pool: kuratiert + user-vorgeschlagen
CREATE TABLE IF NOT EXISTS public.topic_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('glossary','skill','user','bot')),
  source_ref TEXT,
  suggested_by_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','rejected')),
  context_seed TEXT,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topic_pool_status_idx ON public.topic_pool(status);

ALTER TABLE public.topic_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read topic_pool" ON public.topic_pool;
CREATE POLICY "Public read topic_pool" ON public.topic_pool FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert topic_pool" ON public.topic_pool;
CREATE POLICY "Auth insert topic_pool" ON public.topic_pool FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND source = 'user');

-- Artikel
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topic_pool(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','researched','drafted','illustrated','reviewed','published','retired')),
  body_markdown TEXT,
  hero_image_url TEXT,
  contributor_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  edit_lock_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles(status);
CREATE INDEX IF NOT EXISTS articles_published_idx ON public.articles(published_at DESC);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read articles" ON public.articles;
CREATE POLICY "Public read articles" ON public.articles FOR SELECT USING (true);

-- Job-Queue
CREATE TABLE IF NOT EXISTS public.article_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('topic_propose','research','draft','illustrate','code_snippet','review','revise')),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','assigned','done','failed')),
  required_capability TEXT NOT NULL CHECK (required_capability IN ('llm','image','rag')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  result JSONB,
  quality_score INT,
  retry_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_jobs_status_idx ON public.article_jobs(status);
CREATE INDEX IF NOT EXISTS article_jobs_assigned_idx ON public.article_jobs(assigned_to);
CREATE INDEX IF NOT EXISTS article_jobs_article_idx ON public.article_jobs(article_id, created_at DESC);

ALTER TABLE public.article_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read article_jobs" ON public.article_jobs;
CREATE POLICY "Public read article_jobs" ON public.article_jobs FOR SELECT USING (true);

-- Realtime für Living-Feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_jobs;

-- Revisions (Wikipedia-Style Edit-History)
CREATE TABLE IF NOT EXISTS public.article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  body_markdown TEXT,
  contributor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.article_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_revisions_article_idx
  ON public.article_revisions(article_id, created_at DESC);

ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read revisions" ON public.article_revisions;
CREATE POLICY "Public read revisions" ON public.article_revisions FOR SELECT USING (true);

-- Profile-Erweiterungen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS donate_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donate_threshold INT NOT NULL DEFAULT 30
    CHECK (donate_threshold BETWEEN 10 AND 90),
  ADD COLUMN IF NOT EXISTS donate_show_credit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS swarm_jobs_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swarm_jobs_reset_at DATE;
