-- 101_skill_catalog_seed.sql
-- 20 Skills aus 7 Pfaden (MVP Phase 1)

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works, token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
-- HUB
('api_keys', 'API-Keys verwalten', '🔑', 'hub', 'config', 'konfig',
 'Du hinterlegst kostenlose Schlüssel bei Anbietern wie Groq oder Hugging Face. Diese sind Voraussetzung für Sprachmodelle, Bild-Generation und mehr.',
 'Du fügst deine Keys über ein Formular ein. Sie werden sicher in deinem persönlichen Bereich gespeichert und nur an den jeweiligen Dienst weitergeleitet — niemand sonst sieht sie.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 60, 320, 1),

('telegram', 'Telegram-Bot verbinden', '🤖', 'hub', 'config', 'konfig',
 'Du erstellst deinen eigenen Telegram-Bot kostenlos in 3 Minuten und steckst seinen Schlüssel hier ein. Dann schreibst du deinem Agenten in Telegram.',
 'Eine Anleitung führt dich durch @BotFather. Den Bot-Schlüssel trägst du ein, ein <span class="term">Webhook</span> auf der Plattform nimmt deine Nachrichten an.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 60, 380, 2),

-- DATEN
('weather', 'Wetter', '🌤️', 'daten', 'script', 'action',
 'Frag deinen Agenten nach dem Wetter in einer Stadt — er antwortet mit Temperatur, Wind und einer kurzen Beschreibung.',
 'Skript ruft zwei kostenlose Dienste auf: Geocoding wandelt den Ortsnamen in Koordinaten, Forecast liefert aktuelle Daten. Du lernst dabei was eine <span class="term">REST-API</span> ist.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/wetter|wie ist das wetter|wetter in)', 280, 50, 10),

('web_search', 'Web-Suche', '🔍', 'daten', 'script', 'action',
 'Stelle Wissensfragen — der Agent sucht im Web und gibt eine kurze Zusammenfassung.',
 'Skript fragt DuckDuckGo Instant Answer ab — eine direkte API ohne Suchergebnisse zum Klicken. Schnell, kostenlos, ohne <span class="term">Token</span>-Verbrauch.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/such|^suche\s|^finde\s|was bedeutet)', 420, 40, 11),

('wikipedia', 'Wikipedia-Lookup', '📖', 'daten', 'script', 'action',
 '„Was ist X?" — der Agent liefert dir eine Kurzfassung aus Wikipedia.',
 'Skript ruft Wikipedia''s öffentliche <span class="term">REST-API</span> auf und holt die Kurzbeschreibung des Themas. Unbegrenzt, kostenlos.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/wiki|^wikipedia\s|^was ist\s)', 560, 60, 12),

('currency', 'Wechselkurse', '💱', 'daten', 'script', 'action',
 '„Wie viel sind 50 USD in EUR?" — aktuelle Wechselkurse von der EZB.',
 'Skript ruft frankfurter.app — eine kostenlose API die EZB-Daten ausgibt. Kein Login, kein Key.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/kurs|wechselkurs|wie viel\s+\d+\s+\w+\s+in)', 420, 100, 13),

('countries', 'Länder-Info', '🌍', 'daten', 'script', 'action',
 'Einwohnerzahl, Hauptstadt, Flagge, Sprachen eines Landes — sofort verfügbar.',
 'Skript fragt RestCountries.com ab — kostenlose strukturierte Geo-Daten. Sehr schnell, kein <span class="term">Token</span>-Verbrauch.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/land|info zu (deutschland|frankreich|spanien|italien|polen|österreich|schweiz)|hauptstadt von)', 560, 120, 14),

('rss', 'RSS-Reader', '📰', 'daten', 'config', 'konfig',
 'Abonniere RSS-Feeds beliebiger Webseiten. Bei neuen Einträgen pingt dich dein Bot.',
 'Du gibst eine Feed-URL ein, die Plattform prüft alle 30 Min auf neue Einträge und schickt sie als Telegram-Nachricht. Du lernst dabei <span class="term">RSS</span>, ein offenes Web-Standard-Format.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, NULL, 700, 80, 15),

-- SICHERHEIT
('hash_tools', 'Hash & UUID', '🆔', 'sicherheit', 'script', 'browser',
 'Erzeuge SHA-256-Hashes oder UUIDs für deine Projekte.',
 'Browser-eigene Crypto-API rechnet die Werte aus. Lehrt: kryptografische <span class="term">Hash-Funktion</span>en und ihre Anwendungen.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 280, 170, 20),

('password_gen', 'Passwort-Generator', '🔐', 'sicherheit', 'script', 'browser',
 'Erzeuge sichere Passwörter mit konfigurierbarer Länge und Zeichensatz.',
 'Browser-eigene <span class="term">Crypto-Random</span>-Funktion liefert echte Entropie. Lehrt: warum Passwort-Länge wichtiger ist als Sonderzeichen.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 420, 200, 21),

('leak_check', 'Passwort-Leak-Check', '🚨', 'sicherheit', 'script', 'browser',
 'Wurde dein Passwort schon mal geleakt? Sichere Prüfung ohne dass jemand dein Passwort sieht.',
 'HaveIBeenPwned mit <span class="term">k-Anonymity</span>: nur die ersten 5 Zeichen des Hashes werden gesendet, das echte Passwort bleibt bei dir.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 560, 200, 22),

-- TRACKING
('notes', 'Notizen & Listen', '📝', 'tracking', 'script', 'action',
 'Speichere Notizen, Listen, Ideen — schreib einfach in Telegram „notiz: Milch kaufen".',
 'Skript erkennt das Schlüsselwort und legt die Notiz in deiner persönlichen Datenablage ab. Du lernst dabei das Konzept einer einfachen Datenbank.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/notiz|^notiz:|^liste:)', 280, 290, 30),

('mood', 'Stimmungs-Tracker', '😊', 'tracking', 'script', 'action',
 'Täglich kurz „Stimmung: 4/5" — am Wochenende kriegst du eine Auswertung mit Trend.',
 'Skript parst die Zahl, speichert sie zeitlich. Am Sonntag rechnet ein <span class="term">Cron-Job</span> den Wochenschnitt aus.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/stimmung|^stimmung:|^mood:)\s*(\d)', 420, 290, 31),

('habits', 'Gewohnheits-Tracker', '💪', 'tracking', 'script', 'action',
 'Halte Gewohnheiten fest: „heute meditiert" / „heute Sport gemacht". Streak wird gezählt.',
 'Skript prüft jeden Tag um Mitternacht ob du eingetragen hast und berechnet deinen <span class="term">Streak</span>. Bei Bruch sanfte Erinnerung am nächsten Tag.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/habit|^habit:|^heute\s+\w+\s+gemacht|geübt)', 560, 310, 32),

-- AUTOMATION
('reminder', 'Erinnerungen', '⏰', 'automation', 'script', 'action',
 'Sag dem Bot „in 30 min erinnere mich an Yoga" — er pingt dich pünktlich.',
 'Skript parst Zahl + Zeiteinheit + Text. Eintrag in Reminder-Tabelle. Ein <span class="term">Cron-Job</span> prüft jede Minute fällige Reminder.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/erinner|in\s+\d+\s+(min|stunde|h)\s)', 280, 400, 40),

('pomodoro', 'Pomodoro-Timer', '🍅', 'automation', 'script', 'action',
 'Klassische Pomodoro-Technik: 25 Min Fokus, 5 Min Pause. Bot pingt dich.',
 'Skript startet zwei verkettete Reminder. Lehrt: Zeit-Blocking-Methode + verkettete <span class="term">Cron-Job</span>s.',
 '0', '["reminder"]'::jsonb, '[]'::jsonb, '(?i)(\/pomodoro|^pomodoro)', 420, 410, 41),

-- SPIELEREI
('qr_code', 'QR-Code Generator', '📷', 'spielerei', 'script', 'browser',
 'URL oder Text → QR-Code. Direkt im Browser, kein Server.',
 'Browser-eigene Bibliothek rechnet das QR-Muster aus und zeichnet es auf ein Canvas. Lehrt: Reed-Solomon-Fehlerkorrektur in QR-Codes.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 280, 490, 50),

('dice', 'Würfel / Münze / Picker', '🎲', 'spielerei', 'script', 'browser',
 'Wer kocht heute? Welcher Film? Würfel rollt direkt im Browser.',
 'Pure JavaScript-Zufallsfunktion. Lehrt nebenbei: was ist ein Pseudozufalls-Generator.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 420, 500, 51),

('math_practice', 'Mathe-Übungen', '🧮', 'spielerei', 'script', 'browser',
 'Übe Kopfrechnen mit Aufgaben passend zu deinem Level.',
 'Skript generiert Aufgaben prozedural, prüft deine Antwort, tracked deinen Streak. Lehrt: prozedurale Generierung.',
 '0', '[]'::jsonb, '[]'::jsonb, NULL, 560, 510, 52),

('joke_quote', 'Witz / Zitat des Tages', '😄', 'spielerei', 'script', 'action',
 '„Witz!" → der Bot wirft dir einen kurzen Spruch zu.',
 'Skript greift auf eine kostenlose Witz-API zu (JokeAPI). Bei Fehler fällt es auf eine lokale Sammlung zurück.',
 '0', '["telegram"]'::jsonb, '[]'::jsonb, '(?i)(\/witz|\/joke|^witz|^zitat)', 700, 510, 53)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type,
  verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description,
  how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires,
  required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x,
  display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
