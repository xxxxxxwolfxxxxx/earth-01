// Skill-Registry: zentrale Pattern-Liste + Routing.
// Wird vom telegram-webhook benutzt um eingehende Nachrichten zu klassifizieren.

export interface SkillMeta {
  id: string;
  path: string;
  pattern?: RegExp;
  requires_keys?: string[];
}

// Pattern stammen aus der DB (Spalte skills.pattern), hier als TS-Kopie.
// Diese Liste muss synchron zur 101_skill_catalog_seed.sql sein.
export const SKILL_REGISTRY: SkillMeta[] = [
  { id: 'weather',       path: 'daten',      pattern: /(\/wetter|wie ist das wetter|wetter in)/i },
  { id: 'web_search',    path: 'daten',      pattern: /(\/such|^suche\s|^finde\s|was bedeutet)/i },
  { id: 'wikipedia',     path: 'daten',      pattern: /(\/wiki|^wikipedia\s|^was ist\s)/i },
  { id: 'currency',      path: 'daten',      pattern: /(\/kurs|wechselkurs|wie viel\s+\d+\s+\w+\s+in)/i },
  { id: 'countries',     path: 'daten',      pattern: /(\/land|info zu (deutschland|frankreich|spanien|italien|polen|österreich|schweiz)|hauptstadt von)/i },
  { id: 'notes',         path: 'tracking',   pattern: /(\/notiz|^notiz:|^liste:)/i },
  { id: 'mood',          path: 'tracking',   pattern: /(\/stimmung|^stimmung:|^mood:)\s*\d/i },
  { id: 'habits',        path: 'tracking',   pattern: /(\/habit|^habit:|^heute\s+\w+\s+gemacht|geübt)/i },
  { id: 'reminder',      path: 'automation', pattern: /(\/erinner|in\s+\d+\s+(min|stunde|h)\s)/i },
  { id: 'pomodoro',      path: 'automation', pattern: /(\/pomodoro|^pomodoro)/i },
  { id: 'joke_quote',    path: 'spielerei',  pattern: /(\/witz|\/joke|^witz|^zitat)/i },
  { id: 'ask_memory',    path: 'llm',        pattern: /(?:^|\s)(?:\/frag|frag)\s+(.+)/i, requires_keys: ['llm_api_key','huggingface_key'] },
  { id: 'quota_check',   path: 'spielerei',  pattern: /(?:\/quota|\/limits|^quota$|^limits$|wie viel\s+(?:token|quota))/i },
  { id: 'image_gen',     path: 'spielerei',  pattern: /(?:\/bild|\/image|mal mir|bild von|bild:)\s+/i, requires_keys: ['huggingface_key'] },
  { id: 'voice_out',     path: 'spielerei',  pattern: /(?:\/sage|\/voice|sag(?:'s)?|sprich)\s+/i, requires_keys: ['elevenlabs_key'] },
  { id: 'mail_send',     path: 'automation', pattern: /(?:\/mail|mail an)\s+/i, requires_keys: ['resend_api_key'] },
];

export function matchSkill(message: string): SkillMeta | null {
  for (const s of SKILL_REGISTRY) {
    if (s.pattern && s.pattern.test(message)) return s;
  }
  return null;
}
