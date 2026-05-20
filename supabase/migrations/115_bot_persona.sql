-- 115_bot_persona.sql
-- Bot-Persona: User definiert Name, Rolle, Tonalität seines Bots. Wird in
-- alle LLM-Antworten injiziert (System-Prompt-Prefix).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bot_name  TEXT,
  ADD COLUMN IF NOT EXISTS bot_role  TEXT,
  ADD COLUMN IF NOT EXISTS bot_tone  TEXT,
  ADD COLUMN IF NOT EXISTS bot_extra TEXT;

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('bot_persona', 'Bot-Persona', '🎭', 'llm', 'config', 'konfig',
 'Gib deinem Bot einen Namen, eine Rolle und einen Ton. Ab dann antwortet er konsequent in diesem Stil — bei /frag, Auto-Recall und freiem Chat.',
 'Vier Felder (Name, Rolle, Ton, Extra-Anweisungen) werden als <span class="term">Prompt</span>-Prefix in den System-Prompt jedes LLM-Calls injiziert. Lehrt <span class="term">Prompt-Engineering</span> in der Praxis.',
 '0', '["embed_setup"]'::jsonb, '[]'::jsonb, NULL,
 840, 860, 54)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  requires = EXCLUDED.requires,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
