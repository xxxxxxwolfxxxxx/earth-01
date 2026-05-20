-- 116_chat_skill.sql
-- Freier Chat mit dem LLM (mit Bot-Persona wenn konfiguriert).

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('chat', 'Freier Chat', '💬', 'llm', 'llm', 'action',
 'Schick deinem Bot „/chat Erklär mir Quantenphysik" und er antwortet als Sprachmodell — in deiner gewählten Persona, wenn du eine eingerichtet hast.',
 'Skript schickt deine Frage direkt an dein konfiguriertes Sprachmodell (Groq/OpenAI/NVIDIA/etc.) mit dem System-Prompt deiner <span class="term">Persona</span>. Anders als /frag wird hier <em>nicht</em> in deinen Notizen gesucht — das ist ein freies Gespräch.',
 '~500', '["embed_setup"]'::jsonb, '["llm_api_key"]'::jsonb,
 '(?:^|\s)\/chat\s+(.+)|^(?:was|wer|wieso|warum|wie|wo|wann)\s+',
 1000, 860, 55)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
