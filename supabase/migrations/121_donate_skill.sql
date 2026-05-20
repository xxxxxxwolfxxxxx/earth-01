-- 121_donate_skill.sql
-- Skill: donate_tokens — User schaltet die Token-Spende für den Schwarm frei.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('donate_tokens', 'Token-Spende für Earth', '🌱', 'llm', 'config', 'konfig',
 'Spende dein restliches Free-Tier-Kontingent kurz vor Mitternacht. Dein Bot wird Teil eines Schwarms, der gemeinsam Artikel auf der Plattform erzeugt.',
 'Cron-Job prüft 30 Min vor Provider-Reset deinen Verbrauch. Liegt er unter deiner Schwelle, kriegt dein Bot einen Job aus der Pipeline (Recherche, Schreiben, Illustration etc.). Pro Job max 12 LLM-Calls. Pro Tag max 3 Jobs. Aktiviert sich plattformweit erst ab 10 spendenden Bots.',
 '0', '["embed_setup"]'::jsonb, '[]'::jsonb, NULL,
 1140, 860, 460)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  requires = EXCLUDED.requires,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
