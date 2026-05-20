-- 118_live_earth.sql
-- Standort-Koordinaten pro User + Live-Aktivitäts-Log für die Landing-Earth.

-- 1. Profile bekommt lat/lon (gefüllt beim Briefing-Speichern oder weather-Skill)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_city TEXT;

-- 2. Aktivitäts-Tabelle. Webhook insertet bei Skill-Ausführung.
--    Realtime-Subscription daraufhin → Frontend animiert Lichtstrahl.
CREATE TABLE IF NOT EXISTS public.agent_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  skill_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_activity_created_idx
  ON public.agent_activity(created_at DESC);

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

-- Jeder darf alle Aktivitäten sehen (anonymisiert via Coords-only beim Frontend-Select).
-- User_id wird intern verwendet, aber nicht zum Browser geschickt.
DROP POLICY IF EXISTS "Public read activity" ON public.agent_activity;
CREATE POLICY "Public read activity"
  ON public.agent_activity
  FOR SELECT
  USING (true);

-- Nur Service-Role schreibt (Edge Function), Insert von Public blockiert.
DROP POLICY IF EXISTS "Service writes activity" ON public.agent_activity;
CREATE POLICY "Service writes activity"
  ON public.agent_activity
  FOR INSERT
  WITH CHECK (false);

-- Realtime aktivieren (Publication ist supabase_realtime, ab default an)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity;

-- Aufräumen: alles älter als 5 Minuten löschen — wir wollen nur Live-Bursts zeigen.
-- pg_cron-Job dafür wäre overkill bei 1 Cron-Slot; stattdessen periodisch via Trigger oder
-- einfach im reminder-tick mit-aufräumen.
