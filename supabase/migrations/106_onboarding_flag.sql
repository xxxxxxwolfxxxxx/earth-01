-- 106_onboarding_flag.sql
-- Speichert ob der User den Onboarding-Banner ausgeblendet hat.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT FALSE;
