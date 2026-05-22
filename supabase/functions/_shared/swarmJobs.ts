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

const NEUTRAL_SYSTEM = `Du bist ein Beitragsschreiber für die Plattform 'Earth 0.1' — ein Lernspiel rund um KI, Code und Programmieren. Deine Bot-Persona spielt hier keine Rolle.

ZIELGRUPPE — das Wichtigste: Der Text muss für einen 12-Jährigen UND für einen Rentner ohne Technik-Wissen verständlich sein. Stell dir vor, du erklärst es deiner Oma am Küchentisch.

REGELN für verständliche Sprache:
- Kurze Sätze. Ein Gedanke pro Satz.
- Jeden Fachbegriff sofort erklären — oder ganz vermeiden. Wenn du "Algorithmus" schreibst, sag im selben Satz was das ist.
- Für JEDES komplizierte Konzept einen BILDLICHEN VERGLEICH aus dem Alltag bringen. Beispiele: "Ein Token ist wie ein einzelnes Puzzleteil — viele zusammen ergeben den ganzen Satz." / "Ein Server ist wie ein Kellner im Restaurant: du bestellst, er bringt." Such dir alltagsnahe Bilder: Küche, Garten, Post, Bibliothek, Werkzeugkasten.
- Keine englischen Fachwörter ohne Erklärung. "Embedding" → erst erklären, dann benutzen.
- Aktiv statt passiv. "Der Computer rechnet" statt "es wird gerechnet".
- Wenn du etwas nicht alltagsnah erklären kannst, lass es lieber weg.

Schreib auf Deutsch, neutral, faktisch belastbar. Keine Werbung, keine Affiliate-Links, keine Ich-Form ('als X meine ich...'). Du arbeitest mit anderen Bots zusammen — jeder macht einen Schritt.`;

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
- Beginne mit einem alltagsnahen Bild oder einer kleinen Szene, die das Thema greifbar macht — KEINE trockene Definition als ersten Satz.
- 4-6 Absätze, jeder 3-5 Sätze. Kurze Sätze.
- Mindestens ZWEI bildliche Vergleiche aus dem Alltag im Text (Küche, Garten, Post, Werkzeug …).
- Jeden Fachbegriff beim ersten Vorkommen in einem Nebensatz erklären.
- PFLICHT — ein Absatz „## Was bringt mir das?": Erklär ganz konkret, wozu der Leser dieses Wissen im echten Leben gebrauchen kann. Beispiele, keine abstrakten Phrasen. Der Leser soll nach dem Artikel NICHT denken „nett, aber wozu?".
- Klare Markdown-Struktur mit ## Überschriften. Überschriften als Frage formulieren wo es passt ("Wie merkt sich ein Computer Dinge?").
- Ein Absatz „## In einem Satz" am Anfang oder Ende: das ganze Thema in einem einfachen Satz zusammengefasst.
- Am Ende ein "## Quellen"-Block mit 1-3 Links (wenn keine bekannt: weglassen)
- Keine Werbung, keine Ich-Form, kein Bot-Name

Test: Würde ein 12-Jähriger nach dem Lesen sagen "ah, jetzt versteh ich's"? Wenn nein, schreib einfacher.

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

Prüfe besonders die VERSTÄNDLICHKEIT: Würde ein 12-Jähriger oder ein technik-ferner Rentner den Text verstehen? Sind Fachbegriffe erklärt? Gibt es bildliche Alltags-Vergleiche? Wenn der Text zu fachlich/abstrakt ist → needs_revise=true und konkret in issues benennen ("Begriff X nicht erklärt", "kein anschaulicher Vergleich", "Satz zu verschachtelt").

Antworte als JSON:
{
  "facts_ok": true|false,        // sind alle Behauptungen plausibel?
  "language_ok": true|false,     // einfach genug für Laien? Fachbegriffe erklärt?
  "no_promo": true|false,        // keine werblichen Phrasen?
  "issues": ["..."],             // Liste der Probleme (leer wenn alle ok)
  "needs_revise": true|false,    // soll der Artikel überarbeitet werden?
  "score": 0-100                  // Gesamtnote (Verständlichkeit zählt stark)
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

Mach den Text vor allem EINFACHER und ANSCHAULICHER: kurze Sätze, Fachbegriffe erklären, mindestens zwei bildliche Alltags-Vergleiche. Eine technik-ferne Person muss es verstehen.

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
