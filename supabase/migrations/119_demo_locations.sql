-- 119_demo_locations.sql
-- Demo-Punkte für die Live-Earth, damit auch ohne reale User Lichter erscheinen.

CREATE TABLE IF NOT EXISTS public.demo_locations (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.demo_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read demo" ON public.demo_locations;
CREATE POLICY "Public read demo" ON public.demo_locations
  FOR SELECT USING (true);

INSERT INTO public.demo_locations (city, lat, lon) VALUES
  ('Hamburg',     53.55, 10.00),
  ('Berlin',      52.52, 13.40),
  ('München',     48.14, 11.58),
  ('Wien',        48.21, 16.37),
  ('Zürich',      47.37,  8.55),
  ('Lissabon',    38.72, -9.14),
  ('New York',    40.71, -74.00),
  ('Tokio',       35.68, 139.76),
  ('Sydney',     -33.86, 151.21),
  ('São Paulo',  -23.55, -46.63)
ON CONFLICT DO NOTHING;
