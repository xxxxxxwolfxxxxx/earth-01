-- 110_quota_skill.sql
-- Token-Budget-Skill: zeigt Free-Tier-Limits aller verbundenen Provider.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('quota_check', 'Limits im Blick', '📊', 'spielerei', 'script', 'action',
 'Frag deinen Bot „/quota" und siehst sofort wie viel Free-Tier du noch übrig hast — bei allen verbundenen Providern.',
 'Skript fragt parallel die Usage-Endpoints von ElevenLabs, DeepL, Stability AI, Hugging Face etc. ab. Für Provider ohne Usage-API werden <span class="term">Rate-Limit</span>-Header gelesen.',
 '0', '["api_keys"]'::jsonb, '[]'::jsonb,
 '(?i)(?:\/quota|\/limits|^quota$|^limits$|wie viel\s+(token|quota))',
 880, 580, 33)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
