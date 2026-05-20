-- 105_platform_settings.sql
-- Plattform-weite Einstellungen (Singleton-Stil): hier landen Affiliate-IDs,
-- die der Plattform-Betreiber verwaltet. Für alle Besucher lesbar,
-- schreibbar nur von Admins.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Bootstrap: der erste registrierte User wird Admin.
UPDATE public.profiles
SET is_admin = TRUE
WHERE id = '6d2b55e3-8229-435f-9d30-4380f328c2ee';

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read platform_settings" ON public.platform_settings;
CREATE POLICY "Public read platform_settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin write platform_settings" ON public.platform_settings;
CREATE POLICY "Admin write platform_settings"
  ON public.platform_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Default-Eintrag für Affiliate-Links (leeres Objekt)
INSERT INTO public.platform_settings(key, value)
VALUES ('affiliate_links', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
