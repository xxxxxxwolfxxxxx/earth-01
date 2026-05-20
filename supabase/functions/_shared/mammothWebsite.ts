// Job-Definitionen für die Mammutaufgabe "Persönliche Website".
// 13 Job-Typen, sequentiell.

export type MammothJobType =
  | 'mammoth_brief' | 'mammoth_design_concept'
  | 'mammoth_section_hero' | 'mammoth_section_about'
  | 'mammoth_section_services' | 'mammoth_section_contact'
  | 'mammoth_image_hero' | 'mammoth_image_secondary'
  | 'mammoth_html_assemble' | 'mammoth_css_styling'
  | 'mammoth_review_html' | 'mammoth_revise' | 'mammoth_package';

export interface MammothJobDef {
  type: MammothJobType;
  capability: 'llm' | 'image';
  buildSystemPrompt: () => string;
  buildUserPrompt: (ctx: MammothCtx) => string;
}

export interface MammothCtx {
  brief: any;                  // User-Brief (Name, Slogan, Stil, ...)
  results: Record<string, any>; // bisherige Job-Results
}

const SYS = `Du baust Webseiten für die Plattform Earth 0.1. Schreib präzises, semantisches HTML5 und modernes CSS3. Keine Frameworks, kein React. Keine externen Skripte. Keine Werbung. Antworten kurz halten — nur das angefragte Artefakt, keine Erklärung drumherum.`;

export const MAMMOTH_JOBS: Record<MammothJobType, MammothJobDef> = {
  mammoth_brief: {
    type: 'mammoth_brief', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Verfeinere das folgende Website-Brief. Gib JSON zurück mit normierten Feldern.

User-Input:
${JSON.stringify(c.brief, null, 2)}

Antworte als JSON:
{
  "site_title": "...",
  "tagline": "...",
  "tone": "professional|warm|playful|minimal",
  "primary_color": "#hex",
  "secondary_color": "#hex",
  "sections": ["hero","about","services","contact"]
}`,
  },

  mammoth_design_concept: {
    type: 'mammoth_design_concept', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Brief: ${JSON.stringify(c.results.mammoth_brief)}

Erstelle ein Design-Konzept. JSON-Antwort:
{
  "style_name": "...",
  "font_pair": { "headings": "Google-Font-Name", "body": "Google-Font-Name" },
  "color_palette": { "bg": "#hex", "fg": "#hex", "accent": "#hex", "muted": "#hex" },
  "layout_note": "z.B. centered single-column, max-width 1100px, generous padding"
}`,
  },

  mammoth_section_hero: {
    type: 'mammoth_section_hero', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Schreibe den Hero-Bereich (Top-Sektion) der Website.

Brief: ${JSON.stringify(c.results.mammoth_brief)}

JSON-Antwort:
{
  "headline": "...",        // max 8 Wörter
  "subline": "...",         // max 20 Wörter
  "cta_text": "..."         // 1-3 Wörter
}`,
  },

  mammoth_section_about: {
    type: 'mammoth_section_about', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Schreibe die "Über mich"-Sektion.

Brief: ${JSON.stringify(c.results.mammoth_brief)}

JSON-Antwort:
{
  "title": "...",
  "paragraphs": ["...", "..."]  // 2-3 Absätze, je 3-4 Sätze
}`,
  },

  mammoth_section_services: {
    type: 'mammoth_section_services', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Schreibe die "Services" oder "Skills"-Sektion (passend zum Brief).

Brief: ${JSON.stringify(c.results.mammoth_brief)}

JSON-Antwort:
{
  "title": "...",
  "items": [
    { "icon": "🎨", "name": "...", "desc": "1 Satz" },
    { "icon": "...", "name": "...", "desc": "..." },
    { "icon": "...", "name": "...", "desc": "..." }
  ]
}`,
  },

  mammoth_section_contact: {
    type: 'mammoth_section_contact', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Schreibe die "Kontakt"-Sektion mit Aufforderungstext.

Brief: ${JSON.stringify(c.results.mammoth_brief)}

JSON-Antwort:
{
  "title": "...",
  "intro": "...",   // 1-2 Sätze
  "cta_label": "...", // z.B. "Schreib mir"
  "email_placeholder": "..." // z.B. "deine@email.de"
}`,
  },

  mammoth_image_hero: {
    type: 'mammoth_image_hero', capability: 'image',
    buildSystemPrompt: () => '',
    buildUserPrompt: (c) =>
`Hero-Bild für eine Website. Stil: ${c.results.mammoth_design_concept?.style_name ?? 'modern'}. Thema: ${c.results.mammoth_brief?.tagline ?? c.results.mammoth_brief?.site_title}. Saubere Komposition, ohne Text, hochaufgelöst, geeignet als Cover-Bild.`,
  },

  mammoth_image_secondary: {
    type: 'mammoth_image_secondary', capability: 'image',
    buildSystemPrompt: () => '',
    buildUserPrompt: (c) =>
`Begleitbild für eine Website-Über-Mich-Sektion. Stil: ${c.results.mammoth_design_concept?.style_name ?? 'modern'}. Thema: ${c.results.mammoth_brief?.tagline}. Sekundär, kann abstrakt sein.`,
  },

  mammoth_html_assemble: {
    type: 'mammoth_html_assemble', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Baue eine vollständige HTML-Single-Page-Website. Verwende semantische HTML5-Tags (<header>, <main>, <section>, <footer>). Inline-CSS-Link auf "style.css". Bilder als "hero.png" und "image-2.png" referenzieren.

Inhalte:
- Hero: ${JSON.stringify(c.results.mammoth_section_hero)}
- About: ${JSON.stringify(c.results.mammoth_section_about)}
- Services: ${JSON.stringify(c.results.mammoth_section_services)}
- Contact: ${JSON.stringify(c.results.mammoth_section_contact)}
- Brief: ${JSON.stringify(c.results.mammoth_brief)}

Gib NUR den HTML-Code zurück, beginnend mit <!DOCTYPE html>. Keine Code-Block-Fences.`,
  },

  mammoth_css_styling: {
    type: 'mammoth_css_styling', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Schreibe ein CSS-File für die Website mit diesem Design-Konzept:

${JSON.stringify(c.results.mammoth_design_concept)}

Anforderungen:
- Mobile-first responsive
- Modern (Flexbox/Grid)
- Klare Hierarchie, gute Lesbarkeit
- Smooth-Scrolling, dezente Animationen
- Google-Fonts-Import oben

Gib NUR den CSS-Code zurück, ohne Markdown.`,
  },

  mammoth_review_html: {
    type: 'mammoth_review_html', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Review der Website. HTML + CSS sind:

HTML (gekürzt): ${(c.results.mammoth_html_assemble?.content ?? '').slice(0, 2000)}...

CSS (gekürzt): ${(c.results.mammoth_css_styling?.content ?? '').slice(0, 2000)}...

Antworte als JSON:
{
  "html_ok": true|false,
  "css_ok": true|false,
  "mobile_ok": true|false,
  "issues": ["..."],
  "needs_revise": true|false,
  "score": 0-100
}`,
  },

  mammoth_revise: {
    type: 'mammoth_revise', capability: 'llm',
    buildSystemPrompt: () => SYS,
    buildUserPrompt: (c) =>
`Verbessere HTML+CSS basierend auf Review.

HTML: ${c.results.mammoth_html_assemble?.content}
CSS: ${c.results.mammoth_css_styling?.content}
Review-Issues: ${JSON.stringify(c.results.mammoth_review_html?.issues)}

Antwort als JSON:
{ "html": "vollständiger neuer HTML-Code", "css": "vollständiger neuer CSS-Code" }`,
  },

  mammoth_package: {
    type: 'mammoth_package', capability: 'llm',
    buildSystemPrompt: () => '',
    buildUserPrompt: () => '',  // Worker handhabt das selbst — ZIP-Bau ohne LLM
  },
};

// Sequenzielle Reihenfolge der Jobs
export const MAMMOTH_WEBSITE_PIPELINE: MammothJobType[] = [
  'mammoth_brief',
  'mammoth_design_concept',
  'mammoth_section_hero',
  'mammoth_section_about',
  'mammoth_section_services',
  'mammoth_section_contact',
  'mammoth_image_hero',
  'mammoth_image_secondary',
  'mammoth_html_assemble',
  'mammoth_css_styling',
  'mammoth_review_html',
  // mammoth_revise wird nur bei needs_revise eingeplant
  'mammoth_package',
];
