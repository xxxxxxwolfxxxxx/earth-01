-- 124_teamwork_skills.sql
-- Neue Skills für Phase 4 (Job-Wirtschaft) im neuen "Gemeinschaft"-Pfad.
-- donate_tokens-Skill wird ausgeblendet (Beschreibung umgeschrieben, Voraussetzungen verschärft).

-- Path-CHECK erweitern um 'gemeinschaft'
ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_path_check;
ALTER TABLE public.skills ADD CONSTRAINT skills_path_check
  CHECK (path IN ('hub','daten','sicherheit','tracking','llm','automation','cloud','spielerei','gemeinschaft'));

-- ── donate_tokens entschärfen ──────────────────────────────
UPDATE public.skills SET
  description = 'Veraltete Spende-Mechanik (Phase 3, nie aktiviert). Nutze stattdessen teamwork.',
  requires = '["bot_persona","embed_setup","ask_memory","auto_recall","prompt_template","chat","quota_check","image_gen","voice_out","leak_check"]'::jsonb
WHERE id = 'donate_tokens';

-- ── Neue Skills im Gemeinschaft-Pfad ──────────────────────
INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('teamwork', 'Bot arbeiten schicken', '🤝', 'gemeinschaft', 'llm', 'action',
 'Schick deinen Bot mit „/arbeiten" auf Job-Tour. Pro fertigem Job kriegst du 0.9 Credits, 0.1 fließt in den Gemeinschafts-Pool. Mit Credits kannst du Mammutaufgaben (z.B. eine ganze Website) starten.',
 'Skript setzt bot_at_work=true. Der <span class="term">Cron-Job</span> reminder-tick weist deinem Bot Pipeline-Jobs zu. Pro fertigem Job +0.9 Credits, 10% Tax in den Pool. Limits: max 3 Jobs/Tag pro Bot, Plattform-Cap 1000/Tag.',
 '~500', '["chat"]'::jsonb, '["llm_api_key"]'::jsonb,
 '(?i)(?:^|\s)(?:\/arbeiten|\/heim|\/credits)(?:\s|$)',
 1100, 1000, 470),

('mammoth_website', 'Mammutaufgabe: Persönliche Website', '🌐', 'gemeinschaft', 'config', 'konfig',
 'Mit 50 Credits initiierst du eine ~15-Stufen-Pipeline, die dir eine fertige persönliche Website baut: HTML+CSS+Bilder als ZIP. Ein einzelner Bot kann das nicht, eine Gruppe in 2-3 Tagen schon.',
 'Auf /bot fülst du ein Formular aus (Name, Slogan, Stil, Sektionen). 50 Credits werden abgebucht. Im Hintergrund läuft eine 15-Job-Pipeline: Brief → Design-Konzept → 4 Sektionen → 3 Bilder → HTML → CSS → Review → ZIP. Sobald fertig: Download-Link auf /bot.',
 '~5000 über alle Jobs zusammen', '["teamwork"]'::jsonb, '[]'::jsonb, NULL,
 1240, 1000, 480)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
