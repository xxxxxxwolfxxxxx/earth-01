// Job-Definitionen für die Schwarm-Pipeline.
// Jede Job-Type hat: required_capability, max_llm_calls, max_images, Prompt-Builder.

export type JobType = 'topic_propose' | 'research' | 'draft' | 'illustrate' | 'code_snippet' | 'review' | 'revise';
export type Capability = 'llm' | 'image' | 'rag';

export interface JobDefinition {
  type: JobType;
  capability: Capability;
  maxLlmCalls: number;
  maxImages: number;
  buildSystemPrompt: (ctx: any) => string;
  buildUserPrompt: (ctx: any) => string;
}

const NEUTRAL_SYSTEM = "Du bist ein Beitragsschreiber für die Plattform 'Earth 0.1' — ein Lernspiel rund um KI, Code und Programmieren. Deine Bot-Persona spielt hier keine Rolle. Schreib neutral, klar, faktisch belastbar auf Deutsch. Keine Werbung, keine Affiliate-Links, keine Ich-Form ('als X meine ich...'). Du arbeitest mit anderen Bots zusammen — jeder macht einen Schritt.";

export const JOBS: Record<JobType, JobDefinition> = {
  topic_propose: {
    type: 'topic_propose', capability: 'llm', maxLlmCalls: 1, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Zu folgendem Thema soll ein Lehr-Artikel entstehen:

Titel-Idee: ${ctx.topic.title}
Quelle: ${ctx.topic.source} — ${ctx.topic.source_ref ?? ''}
Faktischer Seed (musst du strikt beachten): ${ctx.topic.context_seed ?? '(keiner)'}

Schlag einen finalen Titel vor (max 60 Zeichen) und einen 2-3 Sätze langen Ein-Absatz-Anriss als JSON:
{"title": "...", "lead": "..."}`,
  },

  research: {
    type: 'research', capability: 'llm', maxLlmCalls: 5, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Sammle Fakten für einen Artikel "${ctx.article.title}".

Anriss bisher: ${ctx.article.body_markdown ?? ''}
Faktischer Seed: ${ctx.topic.context_seed ?? ''}

Schreibe 5 nummerierte Stichpunkt-Fakten (max 1 Satz pro Fakt), die in einem späteren Artikel verwendet werden können. Keine Erfindungen, nur was du wirklich weißt. Falls unsicher: schreib "(unsicher)" hinter den Punkt.`,
  },

  draft: {
    type: 'draft', capability: 'llm', maxLlmCalls: 12, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Schreibe einen Artikel "${ctx.article.title}".

Bisherige Inhalte (Anriss + Fakten):
${ctx.article.body_markdown}

Aufgabe:
- 4-6 Absätze, jeder 3-5 Sätze
- Klare Markdown-Struktur mit ## Überschriften
- Am Ende ein "## Quellen"-Block mit 1-3 Links (wenn keine bekannt: weglassen)
- Keine Werbung, keine Ich-Form, kein Bot-Name

Gib NUR den Markdown-Inhalt zurück, ohne Code-Block-Wrapper.`,
  },

  illustrate: {
    type: 'illustrate', capability: 'image', maxLlmCalls: 0, maxImages: 1,
    buildSystemPrompt: () => '',
    buildUserPrompt: (ctx) => {
      // Prompt für image_gen-API
      return `Konzeptkunst-Illustration zum Thema "${ctx.article.title}". Stilistisch: digital, sauber, klar erkennbar, ohne Text auf dem Bild. Hintergrund neutral oder thematisch passend. Hauptmotiv zentriert.`;
    },
  },

  code_snippet: {
    type: 'code_snippet', capability: 'llm', maxLlmCalls: 3, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Für den Artikel "${ctx.article.title}" — falls passend, ein kleines Code-Beispiel.

Bisheriger Inhalt: ${ctx.article.body_markdown}

Wenn ein Code-Beispiel das Verständnis konkret bessert: schreibe einen Markdown-Codeblock (max 15 Zeilen, JavaScript oder Python, gut kommentiert).
Wenn kein Code-Beispiel sinnvoll wäre: antworte exakt mit "(kein Code-Snippet nötig)".`,
  },

  review: {
    type: 'review', capability: 'llm', maxLlmCalls: 3, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Review für den folgenden Artikel:

${ctx.article.body_markdown}

Faktischer Seed: ${ctx.topic.context_seed ?? '(keiner)'}

Antworte als JSON:
{
  "facts_ok": true|false,        // sind alle Behauptungen plausibel?
  "language_ok": true|false,     // sprachlich rund?
  "no_promo": true|false,        // keine werblichen Phrasen?
  "issues": ["..."],             // Liste der Probleme (leer wenn alle ok)
  "needs_revise": true|false,    // soll der Artikel überarbeitet werden?
  "score": 0-100                  // Gesamtnote
}`,
  },

  revise: {
    type: 'revise', capability: 'llm', maxLlmCalls: 5, maxImages: 0,
    buildSystemPrompt: () => NEUTRAL_SYSTEM,
    buildUserPrompt: (ctx) =>
`Überarbeite folgenden Artikel basierend auf dem Review.

Aktueller Stand:
${ctx.article.body_markdown}

Review-Probleme:
${(ctx.reviewIssues ?? []).map((s: string) => `- ${s}`).join('\n')}

Schreibe den verbesserten Markdown-Artikel zurück. Keine Meta-Kommentare, kein "ich habe verbessert..."-Vorspann.`,
  },
};

// Nächste Pipeline-Stufe bestimmen
export function nextJobType(currentStatus: string): JobType | null {
  const map: Record<string, JobType | null> = {
    proposed:    'research',
    researched:  'draft',
    drafted:     'illustrate',
    illustrated: 'review',       // code_snippet wird optional vor review eingefügt
    reviewed:    null,           // → published oder revise (entschieden im Worker)
  };
  return map[currentStatus] ?? null;
}

// Nach welcher Job-Type folgt welcher Article-Status
export function statusAfterJob(jobType: JobType): string | null {
  const map: Record<JobType, string | null> = {
    topic_propose: 'proposed',
    research:      'researched',
    draft:         'drafted',
    illustrate:    'illustrated',
    code_snippet:  null, // ändert status nicht
    review:        'reviewed',
    revise:        'reviewed', // nach revise wieder review-Status
  };
  return map[jobType];
}
