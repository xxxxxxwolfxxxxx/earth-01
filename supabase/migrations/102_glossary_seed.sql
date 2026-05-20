-- 102_glossary_seed.sql
-- 28 KI-/Tech-Begriffe für das Mini-Wiki

INSERT INTO public.glossary (key, icon, category, short_desc, example, related, more_skill_id) VALUES
('API', '🔌', 'basics', 'Eine Schnittstelle die zwei Programme miteinander reden lässt. Wenn der Wetterdienst „API hat", kann dein Bot direkt fragen ohne Webseite zu besuchen.', 'OpenWeather, NASA, Wikipedia', '["REST-API","JSON","Endpoint"]'::jsonb, 'weather'),
('REST-API', '🌐', 'basics', 'Die häufigste Art von API. Du fragst per URL etwas, kriegst die Antwort als JSON zurück. Wie eine Speisekarte mit konkreten Bestellungen.', 'GET /api/weather?city=Berlin', '["API","JSON","HTTP"]'::jsonb, 'weather'),
('JSON', '📄', 'basics', 'Ein Format um strukturierte Daten zu transportieren. Computer-lesbar aber auch von Menschen verstehbar.', '{"temp": 8.4, "wind": 12}', '["REST-API","Schema"]'::jsonb, NULL),
('Token', '🪙', 'llm', 'Die kleinste Texteinheit eines Sprachmodells — ungefähr 3-4 Buchstaben. „Hallo" = 1 Token, „außergewöhnlich" = 3 Tokens.', '200 Tokens ≈ 150 Wörter', '["Kontext-Fenster","Token-Budget","Quota"]'::jsonb, NULL),
('Kontext-Fenster', '🪟', 'llm', 'Wie viele Tokens ein Sprachmodell „auf einmal lesen" kann. Bei großen Modellen oft 128.000 Tokens (ca. 100.000 Wörter).', 'Llama 3.3 70b: 128k Tokens', '["Token","Prompt"]'::jsonb, NULL),
('Prompt', '💭', 'llm', 'Die Frage oder Anweisung die du einem Sprachmodell gibst. Gute Prompts sind klar und enthalten Kontext.', '"Du bist ein Koch. Schlag mir aus diesen Zutaten ein Rezept vor: ..."', '["Prompt-Engineering","Kontext-Fenster"]'::jsonb, NULL),
('Prompt-Engineering', '🛠️', 'llm', 'Die Kunst gute Prompts zu schreiben. Strukturierte Anweisungen, Beispiele, klare Rollen-Definition.', 'Few-Shot, Chain-of-Thought, ReAct', '["Prompt","Token"]'::jsonb, NULL),
('Embedding', '🧮', 'llm', 'Ein Text in eine Liste von Zahlen umwandeln, sodass ähnliche Texte ähnliche Zahlen haben. Basis für semantische Suche.', '"Hund" → [0.23, -0.04, 0.91, ...]', '["RAG","Vektor-Suche"]'::jsonb, NULL),
('RAG', '📚', 'llm', 'Retrieval Augmented Generation. Statt das Modell alles wissen zu lassen, gibt man ihm nur passende Dokumente mit. Spart Tokens, holt aktuelle Daten rein.', 'Notiz: „Mein Hund heißt Bello" → bei späterer Frage automatisch dabei', '["Embedding","Kontext-Fenster"]'::jsonb, NULL),
('Quantisierung', '⚡', 'llm', 'Sprachmodelle kleiner machen indem ihre Zahlen auf weniger Bits reduziert werden — von 32 auf 4 Bit. Folge: Modell passt auf ein Handy.', 'Llama 3 (16 GB) → quantisiert (~3 GB)', '["Inferenz","WebGPU"]'::jsonb, NULL),
('Inferenz', '🧠', 'llm', 'Der Moment in dem das Modell eine Antwort generiert. Im Gegensatz zum Training. Inferenz ist das was Tokens kostet.', 'Eine Antwort = ein Inferenz-Schritt', '["Token","Quantisierung"]'::jsonb, NULL),
('Hash-Funktion', '🆔', 'sicherheit', 'Verwandelt einen beliebig langen Text in einen kurzen Fingerabdruck. Selbst kleinste Änderungen am Text ergeben einen komplett anderen Hash.', 'SHA-256("hallo") → 2cf2…b54e', '["k-Anonymity","UUID"]'::jsonb, 'hash_tools'),
('k-Anonymity', '🛡️', 'sicherheit', 'Datenschutz-Trick: man sendet nur einen Teil des Hashes (z.B. ersten 5 Zeichen). Der Server liefert alle passenden Treffer, der Client filtert lokal.', 'Bei HaveIBeenPwned: 5 Zeichen → 500 Treffer → dein Passwort bleibt geheim', '["Hash-Funktion"]'::jsonb, 'leak_check'),
('Crypto-Random', '🎲', 'sicherheit', 'Sicherer Zufallszahlen-Generator vom Browser. Anders als Math.random() vorhersagbar — gut für Passwörter und Keys.', 'crypto.getRandomValues(buf)', '["Hash-Funktion"]'::jsonb, 'password_gen'),
('JWT', '📜', 'sicherheit', 'JSON Web Token — ein Login-Ticket das aus 3 Teilen besteht: Header.Payload.Signatur. Im Payload steht wer du bist + bis wann das Ticket gültig ist.', 'eyJhbGciOiJIUzI1NiI…', '["Hash-Funktion","OAuth"]'::jsonb, NULL),
('Cron', '⏰', 'automation', 'Eine Zeitplan-Sprache. „* * * * *" heißt jede Minute, „0 8 * * *" heißt jeden Morgen 8 Uhr.', '0 8 * * 1 = Montags 8 Uhr', '["Webhook","Scheduler"]'::jsonb, 'reminder'),
('Cron-Job', '🔁', 'automation', 'Ein automatisierter Task der zu festen Zeiten läuft. Ohne dass du etwas anstoßen musst.', 'Reminder-Tick läuft jede Minute', '["Cron","Workflow"]'::jsonb, 'reminder'),
('Webhook', '🪝', 'automation', 'Eine URL bei dir die ein externes System anruft wenn etwas passiert. „Sag mir Bescheid wenn neue Nachricht kommt".', 'Telegram → unsere Plattform', '["REST-API"]'::jsonb, 'telegram'),
('OAuth', '🔑', 'sicherheit', 'Ein Verfahren wie du einer App erlaubst auf deinen Account zuzugreifen, ohne dein Passwort zu verraten.', '„Mit Google anmelden"', '["JWT","API"]'::jsonb, NULL),
('Sprachmodell', '🤖', 'llm', 'Auch LLM (Large Language Model). Ein neuronales Netz das auf Sprache trainiert wurde. Erzeugt Wort für Wort eine Antwort.', 'GPT, Claude, Llama, Mistral', '["Token","Inferenz","Quantisierung"]'::jsonb, NULL),
('LLM', '🤖', 'llm', 'Kurz für Large Language Model — siehe Sprachmodell.', 'Synonym', '["Sprachmodell"]'::jsonb, NULL),
('Endpoint', '📍', 'basics', 'Eine konkrete URL an die du eine API-Anfrage stellst.', 'https://api.example.com/v1/chat', '["REST-API","API"]'::jsonb, NULL),
('Free-Tier', '🆓', 'basics', 'Die kostenlose Nutzungs-Stufe eines Anbieters. Meist mit Limits (z.B. „500 Calls/Tag").', 'Groq Free: ~14.000 Tokens/Min', '["Quota","Rate-Limit"]'::jsonb, NULL),
('Rate-Limit', '🚦', 'basics', 'Eine Begrenzung wie oft du eine API in einer Zeitspanne aufrufen darfst. Bei Überschreitung: HTTP 429.', '10 Calls pro Minute', '["Free-Tier","Quota"]'::jsonb, NULL),
('Quota', '📊', 'basics', 'Dein verbleibendes Kontingent für einen Dienst — Calls, Tokens, MB. Wird zu Reset-Zeitpunkten zurückgesetzt.', '4 von 10 Bildern heute generiert', '["Free-Tier","Rate-Limit","Reset-Fenster"]'::jsonb, NULL),
('Reset-Fenster', '🔄', 'basics', 'Der Zeitpunkt zu dem deine Quota wieder auf voll springt. Meist Mitternacht UTC oder zum vollen Monat.', 'Groq: täglich 00:00 UTC', '["Quota","Rate-Limit"]'::jsonb, NULL),
('Token-Budget', '💰', 'llm', 'Wie viele Tokens du im aktuellen Free-Tier-Fenster noch übrig hast. Sprachmodelle „kosten" Tokens pro Anfrage und Antwort.', '14.000 Tokens/Min bei Groq', '["Token","Quota"]'::jsonb, NULL),
('Streak', '🔥', 'spielerei', 'Wie viele Tage du in Folge eine Gewohnheit eingehalten hast. Sichtbarer Fortschritt motiviert.', '7 Tage in Folge meditiert', '[]'::jsonb, 'habits')
ON CONFLICT (key) DO UPDATE SET
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  short_desc = EXCLUDED.short_desc,
  example = EXCLUDED.example,
  related = EXCLUDED.related,
  more_skill_id = EXCLUDED.more_skill_id;
