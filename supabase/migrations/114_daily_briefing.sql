-- 114_daily_briefing.sql
-- Tägliches Briefing: User abonniert Zeit + Inhalte, Bot pingt pünktlich.

CREATE TABLE IF NOT EXISTS public.briefing_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  hour INT NOT NULL DEFAULT 8 CHECK (hour BETWEEN 0 AND 23),
  minute INT NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  city TEXT,
  include_weather BOOLEAN NOT NULL DEFAULT TRUE,
  include_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  include_mood BOOLEAN NOT NULL DEFAULT TRUE,
  include_habits BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.briefing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own briefing subscription" ON public.briefing_subscriptions;
CREATE POLICY "Own briefing subscription" ON public.briefing_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Skill-Eintrag
INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('daily_briefing', 'Tägliches Briefing', '🌅', 'automation', 'config', 'konfig',
 'Jeden Morgen um deine Wunschzeit fasst dein Bot das Wichtigste zusammen: Wetter, heutige Erinnerungen, Mood-Verlauf, Habit-Streaks.',
 'Auf /data legst du Uhrzeit und Stadt fest. Der <span class="term">Cron-Job</span> reminder-tick prüft jede Minute, ob ein Briefing fällig ist und schickt es als Telegram-Nachricht.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, NULL,
 720, 450, 37)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  requires = EXCLUDED.requires,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
