-- Phase 4.12: Job-Status um 'blocked' und 'skipped' erweitern
-- blocked  — Mammut-Folge-Jobs warten auf den Vorgänger
-- skipped  — illustrate-Job übersprungen (kein Bild-Bot), wird nachgereicht
--            sobald ein Bot Bilder erstellen kann
ALTER TABLE public.article_jobs DROP CONSTRAINT IF EXISTS article_jobs_status_check;
ALTER TABLE public.article_jobs ADD CONSTRAINT article_jobs_status_check
  CHECK (status = ANY (ARRAY['waiting','assigned','done','failed','blocked','skipped']));
