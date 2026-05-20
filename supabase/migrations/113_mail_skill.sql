-- 113_mail_skill.sql
-- Mail-Versand-Skill via Resend.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
('mail_send', 'Mail verschicken', '📧', 'automation', 'script', 'action',
 'Schick deinem Bot „/mail anna@example.com | Treffen morgen | Hallo Anna, treffen wir uns um 14h?" — er verschickt die Mail.',
 'Skript ruft Resend-API auf. 3000 Mails/Monat gratis. Achtung: ohne verifizierte Domain kannst du nur an deine eigene Resend-Account-Mail schicken.',
 '0', '["telegram"]'::jsonb, '["resend_api_key"]'::jsonb,
 '(?:\/mail|mail an)\s+',
 560, 450, 36)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
