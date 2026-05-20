-- 112_voice_out_skill.sql
-- TTS-Skill via ElevenLabs: /sage <Text> sowie Mirror-Modus für Voice-Eingaben.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('voice_out', 'Bot spricht zurück', '🔊', 'spielerei', 'llm', 'action',
 'Schick deinem Bot „/sage Guten Morgen!" — er spricht den Text als Sprachnachricht. Bonus: wenn du ihm eine Sprachnachricht schickst, antwortet er auch mit Stimme.',
 'Skript ruft <span class="term">ElevenLabs</span>-API mit dem Multilingual-Modell auf, kriegt MP3 zurück, schickt es als sendAudio an Telegram. 10.000 Zeichen/Monat gratis.',
 '~0', '["telegram"]'::jsonb, '["elevenlabs_key"]'::jsonb,
 '(?:\/sage|\/voice|sag(?:''s)?|sprich)\s+',
 1160, 580, 35)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
