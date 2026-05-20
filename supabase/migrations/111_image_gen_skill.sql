-- 111_image_gen_skill.sql
-- Bild-Generation-Skill via Hugging Face (FLUX.1-schnell) oder Replicate.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('image_gen', 'Bild malen lassen', '🎨', 'spielerei', 'llm', 'action',
 'Schick deinem Bot „/bild ein Astronaut auf einem Skateboard" — er generiert das Bild und schickt''s zurück.',
 'Skript ruft <span class="term">Hugging Face</span>'' Inference-API mit FLUX.1-schnell auf (gratis, ~3 Sek). Wenn du einen Replicate-Key hast, läuft''s über deren API (höhere Qualität).',
 '~0', '["api_keys"]'::jsonb, '["huggingface_key"]'::jsonb,
 '(?:\/bild|\/image|mal mir|bild von|bild:)\s+',
 1020, 580, 34)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
