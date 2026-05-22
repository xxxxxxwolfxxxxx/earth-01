-- Phase 4.13: RSS-Reader-Feature
-- User abonniert Feeds per /rss <url>. reminder-tick prüft sie und pusht neue Einträge.

CREATE TABLE IF NOT EXISTS public.rss_feeds (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url      TEXT NOT NULL,
  feed_title    TEXT,
  last_entry_key TEXT,          -- GUID/Link/pubDate des zuletzt gepushten Eintrags
  last_checked_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, feed_url)
);
CREATE INDEX IF NOT EXISTS rss_feeds_user_idx ON public.rss_feeds(user_id);

ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rss_feeds_owner_select ON public.rss_feeds;
CREATE POLICY rss_feeds_owner_select ON public.rss_feeds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rss_feeds_service_all ON public.rss_feeds;
CREATE POLICY rss_feeds_service_all ON public.rss_feeds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
