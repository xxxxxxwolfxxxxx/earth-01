// Frontend-Pendant zu botMessages.ts (Backend).

export const BOT_TEXT = {
  // Lesson-Cards
  lesson_card2_waiting: 'Dein Bot wartet. Schreib ihm in Telegram.',
  lesson_card2_browser: 'Probier es jetzt unten — dein Bot übernimmt den Rest.',
  lesson_card2_konfig: 'Trag deinen Schlüssel ein — dein Bot testet ob er funktioniert.',
  lesson_card3_success: 'Geschafft! 🎉',
  lesson_card3_next: 'Nächster Skill →',

  // Tech-Tree-Übersicht
  tree_progress: (done, total) => `${done} von ${total} Fähigkeiten gelernt`,
  tree_path_locked: 'Voraussetzungen erfüllen, dann startet dieser Pfad.',
  tree_no_dynasty: 'Schalte deine ersten Werkzeuge frei — dein Bot lernt dabei.',

  // Keys-Page
  keys_save_ok: 'Schlüssel gespeichert. Dein Bot fühlt sich gleich stärker.',
  keys_test_fail: (provider) => `${provider} sagt: Schlüssel akzeptiert er nicht. Prüf nochmal.`,
  keys_no_key_yet: 'Dein Bot kann noch kein Sprachmodell nutzen. Trag einen kostenlosen Key ein.',

  // Allgemein
  loading: 'Dein Bot zieht Daten…',
  empty_state: 'Hier ist noch nichts. Schalt deinen ersten Skill frei.',
};
