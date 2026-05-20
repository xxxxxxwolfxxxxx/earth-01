-- 117_layout_refresh.sql
-- Normalisiert display_order aller Skills auf konsistente 10er-Schritte pro Pfad,
-- sodass die Reihenfolge im Tech-Baum eindeutig vorhersagbar ist.

-- Hub
UPDATE public.skills SET display_order = 10 WHERE id = 'api_keys';
UPDATE public.skills SET display_order = 20 WHERE id = 'telegram';

-- Daten
UPDATE public.skills SET display_order = 100 WHERE id = 'weather';
UPDATE public.skills SET display_order = 110 WHERE id = 'web_search';
UPDATE public.skills SET display_order = 120 WHERE id = 'wikipedia';
UPDATE public.skills SET display_order = 130 WHERE id = 'currency';
UPDATE public.skills SET display_order = 140 WHERE id = 'countries';
UPDATE public.skills SET display_order = 150 WHERE id = 'rss';

-- Sicherheit
UPDATE public.skills SET display_order = 200 WHERE id = 'hash_tools';
UPDATE public.skills SET display_order = 210 WHERE id = 'password_gen';
UPDATE public.skills SET display_order = 220 WHERE id = 'leak_check';

-- Tracking
UPDATE public.skills SET display_order = 300 WHERE id = 'notes';
UPDATE public.skills SET display_order = 310 WHERE id = 'mood';
UPDATE public.skills SET display_order = 320 WHERE id = 'habits';

-- LLM (Reihenfolge: erst Setup, dann Abruf, dann Konfig)
UPDATE public.skills SET display_order = 400 WHERE id = 'embed_setup';
UPDATE public.skills SET display_order = 410 WHERE id = 'ask_memory';
UPDATE public.skills SET display_order = 420 WHERE id = 'auto_recall';
UPDATE public.skills SET display_order = 430 WHERE id = 'chat';
UPDATE public.skills SET display_order = 440 WHERE id = 'bot_persona';
UPDATE public.skills SET display_order = 450 WHERE id = 'prompt_template';

-- Automation
UPDATE public.skills SET display_order = 500 WHERE id = 'reminder';
UPDATE public.skills SET display_order = 510 WHERE id = 'pomodoro';
UPDATE public.skills SET display_order = 520 WHERE id = 'mail_send';
UPDATE public.skills SET display_order = 530 WHERE id = 'daily_briefing';

-- Cloud
UPDATE public.skills SET display_order = 600 WHERE id = 'gdrive_connect';
UPDATE public.skills SET display_order = 610 WHERE id = 'gist_connect';
UPDATE public.skills SET display_order = 620 WHERE id = 'file_upload';

-- Spielerei
UPDATE public.skills SET display_order = 700 WHERE id = 'qr_code';
UPDATE public.skills SET display_order = 710 WHERE id = 'dice';
UPDATE public.skills SET display_order = 720 WHERE id = 'math_practice';
UPDATE public.skills SET display_order = 730 WHERE id = 'joke_quote';
UPDATE public.skills SET display_order = 740 WHERE id = 'quota_check';
UPDATE public.skills SET display_order = 750 WHERE id = 'image_gen';
UPDATE public.skills SET display_order = 760 WHERE id = 'voice_out';
