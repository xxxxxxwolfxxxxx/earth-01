// Zentrale Bot-Sprache: Bot ist Subjekt, leicht verspielter Ton.
// Diese Sätze tauchen in Telegram-Antworten und Reminder-Nachrichten auf.

export const BOT = {
  // Lesson-Verifikation
  lesson_detected: (skill: string) => `Dein Bot hat erkannt: du hast '${skill}' angewandt. ✓`,
  lesson_unlocked: (skill: string) => `🎉 '${skill}' ist jetzt freigeschaltet. Zurück zur Plattform um den nächsten Skill zu wählen.`,

  // Reminder
  reminder_set: (mins: number) => `Dein Bot merkt sich das. Er pingt dich in ${mins} Minuten.`,
  reminder_fire: (content: string) => `⏰ Dein Bot erinnert dich:\n\n${content}`,

  // Allgemein
  unknown_command: () => `Dein Bot kennt das noch nicht. Schalt dafür einen passenden Skill auf der Plattform frei.`,
  needs_key: (keyType: string) => `Dein Bot braucht dafür einen ${keyType}-Key. Hinterleg ihn unter /keys.`,
  needs_skill: (skill: string) => `Dein Bot kennt diese Fähigkeit noch nicht. Erlerne erst '${skill}'.`,
  error: () => `Dein Bot ist über einen Stolperstein gefallen. Versuch es nochmal.`,

  // Tool-spezifisch
  weather_no_city: () => `Sag deinem Bot in welcher Stadt — z.B. '/wetter Berlin'.`,
  search_no_query: () => `Was soll dein Bot suchen? Probier '/suche Geschichte des Internets'.`,
};
