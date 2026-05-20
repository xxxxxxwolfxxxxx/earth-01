-- 104_extra_service_keys.sql
-- Erweitert profiles um zusätzliche Service-Keys.
-- Sodass User auf der /keys-Seite ALLE benötigten Schlüssel zentral pflegen können
-- (auch für Skills, die erst in späteren Phasen freigeschaltet werden).

ALTER TABLE public.profiles
  -- Audio: Spracherkennung & Sprachsynthese
  ADD COLUMN IF NOT EXISTS whisper_key TEXT,
  ADD COLUMN IF NOT EXISTS elevenlabs_key TEXT,

  -- Bilder & Medien
  ADD COLUMN IF NOT EXISTS replicate_key TEXT,
  ADD COLUMN IF NOT EXISTS stability_key TEXT,

  -- Daten-APIs
  ADD COLUMN IF NOT EXISTS openweather_key TEXT,
  ADD COLUMN IF NOT EXISTS deepl_key TEXT,
  ADD COLUMN IF NOT EXISTS brave_search_key TEXT,
  ADD COLUMN IF NOT EXISTS newsapi_key TEXT,

  -- Push-Benachrichtigung (zusätzlich zu Telegram)
  ADD COLUMN IF NOT EXISTS pushover_token TEXT,
  ADD COLUMN IF NOT EXISTS pushover_user TEXT;
