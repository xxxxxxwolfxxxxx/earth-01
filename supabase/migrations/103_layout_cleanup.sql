-- 103_layout_cleanup.sql
-- Räumt Tech-Tree-Layout auf: jeder Pfad bekommt eine eigene horizontale Bahn,
-- Skills sind auf einer Linie (gleiche y), Linien fächern vom Hub aus.

-- HUB (x=60, mittig vertikal)
UPDATE public.skills SET display_x=60, display_y=320 WHERE id='api_keys';
UPDATE public.skills SET display_x=60, display_y=380 WHERE id='telegram';

-- DATEN (y=60, oberste Bahn)
UPDATE public.skills SET display_x=270, display_y=60 WHERE id='weather';
UPDATE public.skills SET display_x=430, display_y=60 WHERE id='web_search';
UPDATE public.skills SET display_x=590, display_y=60 WHERE id='wikipedia';
UPDATE public.skills SET display_x=750, display_y=60 WHERE id='currency';
UPDATE public.skills SET display_x=910, display_y=60 WHERE id='countries';
UPDATE public.skills SET display_x=1070, display_y=60 WHERE id='rss';

-- SICHERHEIT (y=190)
UPDATE public.skills SET display_x=270, display_y=190 WHERE id='hash_tools';
UPDATE public.skills SET display_x=430, display_y=190 WHERE id='password_gen';
UPDATE public.skills SET display_x=590, display_y=190 WHERE id='leak_check';

-- TRACKING (y=320)
UPDATE public.skills SET display_x=270, display_y=320 WHERE id='notes';
UPDATE public.skills SET display_x=430, display_y=320 WHERE id='mood';
UPDATE public.skills SET display_x=590, display_y=320 WHERE id='habits';

-- AUTOMATION (y=450)
UPDATE public.skills SET display_x=270, display_y=450 WHERE id='reminder';
UPDATE public.skills SET display_x=430, display_y=450 WHERE id='pomodoro';

-- SPIELEREI (y=580, unterste Bahn)
UPDATE public.skills SET display_x=270, display_y=580 WHERE id='qr_code';
UPDATE public.skills SET display_x=430, display_y=580 WHERE id='dice';
UPDATE public.skills SET display_x=590, display_y=580 WHERE id='math_practice';
UPDATE public.skills SET display_x=750, display_y=580 WHERE id='joke_quote';
