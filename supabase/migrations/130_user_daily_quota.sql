-- Phase 4.7: Eigene Tages-Quota pro User statt Hard-Cap=3
-- Default 10, User kann selbst hoch/runter — abhängig vom eigenen LLM-Provider.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_jobs_per_day INT DEFAULT 10 NOT NULL;

-- Sanity-Bounds: 0..1000 (0 = nur eigene Mammut-Jobs, kein Schwarm)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_max_jobs_per_day_chk
  CHECK (max_jobs_per_day >= 0 AND max_jobs_per_day <= 1000);
