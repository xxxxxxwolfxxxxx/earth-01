-- Phase 4.14: Jede Lektion erklärt den konkreten Alltagsnutzen.
-- Neue Spalte practical_benefit — "Warum lohnt sich das für dich?"
-- Verständlich für 12-Jährige und Rentner, mit echtem Lebensbezug.

ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS practical_benefit TEXT;

UPDATE public.skills SET practical_benefit = CASE id

  WHEN 'api_keys' THEN 'Ein API-Schlüssel ist wie ein Mitgliedsausweis: er öffnet deinem Bot die Tür zu Diensten wie ChatGPT. Ohne ihn bleibt dein Bot stumm. Hier lernst du, solche Schlüssel sicher zu verwalten — das brauchst du für fast jeden cleveren Skill.'
  WHEN 'ask_memory' THEN 'Dein Bot wird zu deinem zweiten Gedächtnis: „Was hab ich letzte Woche notiert?" — und er findet es. Praktisch, wenn du dir Dinge merken willst, ohne überall Zettel zu verteilen.'
  WHEN 'auto_recall' THEN 'Dein Bot erkennt von selbst, wenn deine Frage zu etwas passt, das du mal notiert hast — und antwortet aus deinem eigenen Wissen, ganz ohne dass du extra danach suchst.'
  WHEN 'bot_persona' THEN 'Du bestimmst, wie dein Bot klingt — sachlich, lustig, wie ein guter Kumpel. So fühlt sich jedes Gespräch an wie mit jemandem, den du magst.'
  WHEN 'chat' THEN 'Dein Bot wird zum Gesprächspartner für alles: Ideen sammeln, Dinge erklären lassen, Rat holen. Wie ein schlauer Freund, der rund um die Uhr Zeit hat.'
  WHEN 'countries' THEN 'Schnell Fakten zu jedem Land — Hauptstadt, Einwohnerzahl, Sprache. Gut für Hausaufgaben, die Reiseplanung oder einfach, wenn dich etwas neugierig macht.'
  WHEN 'currency' THEN 'Was kosten 50 Euro in Dollar? Dein Bot rechnet Wechselkurse sofort um — praktisch vor dem Urlaub oder beim Online-Einkauf im Ausland.'
  WHEN 'daily_briefing' THEN 'Jeden Morgen eine kurze Zusammenfassung: Wetter, deine Termine, deine Stimmung. Wie eine kleine Tageszeitung, die nur für dich gemacht ist.'
  WHEN 'dice' THEN 'Wer kocht heute? Welcher Film? Der Bot würfelt oder zieht ein Los — so trefft ihr Entscheidungen schnell und ohne Streit.'
  WHEN 'embed_setup' THEN 'Damit dein Bot in deinen Notizen „nach Sinn" suchen kann, nicht nur nach exakten Wörtern. Du fragst nach „Urlaub" und er findet auch „Reise" und „Strand".'
  WHEN 'file_upload' THEN 'Lad ein PDF oder eine Notiz hoch — dein Bot kann dir später Fragen dazu beantworten. Wie ein Aktenschrank, der mitdenkt und für dich nachschlägt.'
  WHEN 'gdrive_connect' THEN 'Verbindet deinen Bot mit deiner Google-Drive-Cloud. Notizen, Sprachnachrichten und Dateien landen sicher in deinem eigenen Speicher — nicht bei uns.'
  WHEN 'gist_connect' THEN 'Eine kostenlose Mini-Cloud bei GitHub für die Daten deines Bots — die Alternative zu Google Drive, falls du das lieber nutzt.'
  WHEN 'habits' THEN 'Willst du regelmäßig Sport machen oder weniger am Handy hängen? Der Bot verfolgt deine Gewohnheiten und zeigt deine Serie — das motiviert dranzubleiben.'
  WHEN 'hash_tools' THEN 'Ein Hash ist ein digitaler Fingerabdruck: aus beliebigem Text wird eine feste Zeichenfolge. Ändert sich auch nur ein Buchstabe, ist der Fingerabdruck komplett anders. Wozu das gut ist: So prüfen Computer, ob eine heruntergeladene Datei echt und unverändert ist. Und so speichern seriöse Webseiten Passwörter — nicht im Klartext, sondern als Hash, damit ein Dieb sie nicht lesen kann. Eine UUID ist eine weltweit einmalige Nummer, wie eine Seriennummer, die garantiert kein zweites Mal vergeben wird. Nach dieser Lektion verstehst du, warum „Passwort wird als Hash gespeichert" ein gutes Zeichen für eine sichere Webseite ist.'
  WHEN 'image_gen' THEN 'Beschreib ein Bild in Worten — dein Bot malt es. Für Geburtstagskarten, Bastelideen, Deko oder einfach zum Ausprobieren.'
  WHEN 'joke_quote' THEN 'Ein Witz oder ein kluger Spruch auf Knopfdruck — eine kleine Portion gute Laune zwischendurch.'
  WHEN 'leak_check' THEN 'Prüft, ob dein Passwort schon einmal bei einem Hacker-Angriff gestohlen wurde. Wenn ja, solltest du es sofort ändern. Schützt deine Konten ganz konkret.'
  WHEN 'mail_send' THEN 'Dein Bot verschickt E-Mails für dich — etwa eine Erinnerung an dich selbst oder eine kurze Nachricht, ohne dass du das Mail-Programm öffnen musst.'
  WHEN 'mammoth_website' THEN 'Der Schwarm baut dir eine komplette eigene Website — Startseite, Bilder, Kontaktbereich. Ganz ohne dass du eine einzige Zeile Code schreibst.'
  WHEN 'math_practice' THEN 'Kopfrechnen üben mit Aufgaben, die mit dir mitwachsen. Gut für Kinder in der Schule — oder für alle, die geistig fit bleiben wollen.'
  WHEN 'mood' THEN 'Trag täglich ein, wie es dir geht. Nach ein paar Wochen siehst du Muster — das hilft dir, dich selbst und deine Stimmungen besser zu verstehen.'
  WHEN 'notes' THEN 'Schnell etwas notieren oder eine Einkaufsliste führen — direkt im Chat, immer dabei, und nichts geht verloren.'
  WHEN 'password_gen' THEN 'Sichere Passwörter auf Knopfdruck. „Passwort123" ist in Sekunden geknackt — ein langes Zufallspasswort hält Hacker draußen. Schützt deine Konten.'
  WHEN 'pomodoro' THEN '25 Minuten konzentriert arbeiten, dann eine Pause — der Bot taktet das für dich. Hilft gegen Aufschieben und das Verzetteln.'
  WHEN 'prompt_template' THEN 'Du legst den Grundton deines Bots fest: kurz oder ausführlich, ernst oder locker. Einmal eingestellt, gilt das für alle seine Antworten.'
  WHEN 'qr_code' THEN 'Verwandelt einen Link oder Text in einen QR-Code zum Abscannen — praktisch fürs WLAN-Passwort für Gäste, eine digitale Visitenkarte oder einen Treffpunkt.'
  WHEN 'quota_check' THEN 'Zeigt dir, wie viel von deinem kostenlosen Tages-Kontingent du schon verbraucht hast — damit dein Bot nicht plötzlich mitten am Tag stehenbleibt.'
  WHEN 'reminder' THEN '„Erinnere mich in 2 Stunden an den Kuchen im Ofen" — der Bot meldet sich pünktlich. Dein zuverlässiger Wecker für alles, was du nicht vergessen darfst.'
  WHEN 'rss' THEN 'Abonniere Nachrichtenseiten oder Lieblings-Blogs — neue Artikel kommen automatisch in deinen Chat. Du verpasst nichts und musst nirgends mehr nachschauen.'
  WHEN 'teamwork' THEN 'Schick deinen Bot arbeiten, während du schläfst oder in der Schule bist. Er verdient dabei Credits, mit denen du später große Projekte starten kannst.'
  WHEN 'telegram' THEN 'Dein eigener Bot in Telegram ist die Fernbedienung für alles, was du hier lernst. Ohne ihn bleiben alle Skills graue Theorie — mit ihm werden sie echte Werkzeuge.'
  WHEN 'voice_out' THEN 'Dein Bot antwortet als gesprochene Sprachnachricht statt als Text — praktisch unterwegs, beim Autofahren, oder für alle, die nicht gern lesen.'
  WHEN 'weather' THEN 'Frag nach dem Wetter in jeder beliebigen Stadt — bevor du rausgehst, den Koffer packst oder einen Ausflug planst.'
  WHEN 'web_search' THEN 'Dein Bot durchsucht das Internet und fasst das Wichtigste zusammen — schnelle Antworten, ohne dass du dich durch zehn Webseiten klicken musst.'
  WHEN 'wikipedia' THEN '„Was ist X?" — dein Bot holt die Kurzfassung aus Wikipedia. Schnelles Nachschlagen für die Schule, für Diskussionen oder einfach aus Neugier.'

  ELSE practical_benefit
END
WHERE id IN (
  'api_keys','ask_memory','auto_recall','bot_persona','chat','countries','currency',
  'daily_briefing','dice','embed_setup','file_upload','gdrive_connect','gist_connect',
  'habits','hash_tools','image_gen','joke_quote','leak_check','mail_send','mammoth_website',
  'math_practice','mood','notes','password_gen','pomodoro','prompt_template','qr_code',
  'quota_check','reminder','rss','teamwork','telegram','voice_out','weather','web_search','wikipedia'
);
