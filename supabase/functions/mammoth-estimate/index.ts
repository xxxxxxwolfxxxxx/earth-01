// mammoth-estimate: nimmt einen User-Prompt + LLM des Users
// und liefert einen Job-Plan (welche Jobs werden für dieses Projekt gebraucht).
// Kosten: 1 Credit pro Job.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Was sind die möglichen Job-Typen, die wir in einem Plan vorkommen lassen?
// Das LLM bekommt diese Liste mit Beschreibung — es wählt selbst aus.
const ALLOWED_JOBS = [
  { type: "mammoth_design_concept",   credits: 1, what: "Design-Konzept (Farben, Typo, Tonalität)" },
  { type: "mammoth_section_hero",     credits: 1, what: "Hero-Sektion mit Headline + Untertitel" },
  { type: "mammoth_section_about",    credits: 1, what: "Über-mich/uns-Sektion" },
  { type: "mammoth_section_services", credits: 1, what: "Leistungen/Features-Sektion" },
  { type: "mammoth_section_contact",  credits: 1, what: "Kontakt-Sektion (Adresse, Form)" },
  { type: "mammoth_image_hero",       credits: 2, what: "Hero-Bild generieren (Bild-Job, doppelter Aufwand)" },
  { type: "mammoth_image_secondary",  credits: 2, what: "Zusätzliches Bild generieren" },
  { type: "mammoth_html_assemble",    credits: 1, what: "Alle Sektionen in finales HTML zusammenfügen" },
  { type: "mammoth_css_styling",      credits: 1, what: "CSS-Styling generieren (Layout + responsiv)" },
  { type: "mammoth_review_html",      credits: 1, what: "Qualitäts-Review (Rechtschreibung, Konsistenz)" },
  { type: "mammoth_package",          credits: 1, what: "ZIP-Paket schnüren mit Vorschau-URL" },
];

const SYSTEM_PROMPT = `Du bist ein Projekt-Planer für eine KI-Agenten-Plattform.
Ein User beschreibt was sein Bot bauen soll. Du erstellst einen realistischen Job-Plan.

Verfügbare Jobs (jeder Job = 1-2 Credits):
${ALLOWED_JOBS.map(j => `- ${j.type} (${j.credits} Credits): ${j.what}`).join("\n")}

Regeln:
- IMMER mit "mammoth_design_concept" anfangen
- IMMER mit "mammoth_html_assemble" + "mammoth_css_styling" + "mammoth_review_html" + "mammoth_package" enden (in dieser Reihenfolge)
- Dazwischen die passenden Sektionen + max. 2 Bilder
- Kleine Projekte: 6-8 Jobs (ca. 6-9 Credits). Standard: 9-12. Komplex: bis 16.
- Wenn ein Bild gewünscht ist, plane mammoth_image_hero oder mammoth_image_secondary DIREKT VOR die Sektion in der das Bild erscheint

Antworte AUSSCHLIESSLICH mit JSON in diesem Format:
{
  "title": "Kurzer Projekt-Titel (max 60 Zeichen)",
  "summary": "1-2 Sätze was gebaut wird, für den User",
  "jobs": [
    { "type": "design_concept", "what": "kurze Beschreibung was dieser Job macht" },
    ...
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) return json({ error: "Nicht angemeldet" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (!user) return json({ error: "Token ungültig" }, 401);

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return json({ error: "Beschreib bitte etwas genauer was gebaut werden soll" }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("llm_api_key, llm_base_url, llm_model")
      .eq("id", user.id)
      .single();
    if (!profile?.llm_api_key || !profile.llm_base_url || !profile.llm_model) {
      // Fallback: Heuristik ohne LLM (Standard-Größe)
      return json(estimateHeuristic(prompt));
    }

    const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.llm_api_key}`,
      },
      body: JSON.stringify({
        model: profile.llm_model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt.trim() },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content;
    if (!content) {
      return json(estimateHeuristic(prompt));
    }

    let plan;
    try {
      plan = JSON.parse(content);
    } catch {
      // Manche Modelle wrappen JSON in ```json fences
      const m = content.match(/\{[\s\S]*\}/);
      plan = m ? JSON.parse(m[0]) : null;
    }
    if (!plan?.jobs || !Array.isArray(plan.jobs)) {
      return json(estimateHeuristic(prompt));
    }

    // Validieren + Credit-Kosten zuordnen
    const allowedMap = new Map(ALLOWED_JOBS.map(j => [j.type, j]));
    const cleaned = plan.jobs
      .filter((j: any) => allowedMap.has(j.type))
      .map((j: any) => ({ type: j.type, what: String(j.what ?? allowedMap.get(j.type)!.what).slice(0, 200), credits: allowedMap.get(j.type)!.credits }));
    if (cleaned.length === 0) return json(estimateHeuristic(prompt));

    const total = cleaned.reduce((s: number, j: any) => s + j.credits, 0);

    return json({
      title:   String(plan.title ?? "Projekt").slice(0, 80),
      summary: String(plan.summary ?? "").slice(0, 400),
      jobs:    cleaned,
      total_credits: total,
      generated_by: "llm",
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// Heuristik-Fallback: ohne LLM eine Standard-Größe anbieten
function estimateHeuristic(prompt: string) {
  const len = prompt.length;
  const isLong = len > 200;
  const isComplex = /\b(shop|onlineshop|blog|portal|community|forum|mehrer\w+ seiten|10 seiten|großes|umfangreich)\b/i.test(prompt);
  let template;
  if (isComplex) {
    template = [
      'mammoth_design_concept', 'mammoth_image_hero', 'mammoth_section_hero',
      'mammoth_section_about', 'mammoth_image_secondary', 'mammoth_section_services',
      'mammoth_section_contact',
      'mammoth_html_assemble', 'mammoth_css_styling', 'mammoth_review_html', 'mammoth_package',
    ];
  } else if (isLong) {
    template = [
      'mammoth_design_concept', 'mammoth_image_hero', 'mammoth_section_hero',
      'mammoth_section_about', 'mammoth_section_services', 'mammoth_section_contact',
      'mammoth_html_assemble', 'mammoth_css_styling', 'mammoth_review_html', 'mammoth_package',
    ];
  } else {
    template = [
      'mammoth_design_concept', 'mammoth_section_hero', 'mammoth_section_about',
      'mammoth_section_contact',
      'mammoth_html_assemble', 'mammoth_css_styling', 'mammoth_review_html', 'mammoth_package',
    ];
  }
  const map = new Map(ALLOWED_JOBS.map(j => [j.type, j]));
  const jobs = template.map(t => ({ type: t, what: map.get(t)!.what, credits: map.get(t)!.credits }));
  return {
    title: "Mein Web-Projekt",
    summary: "Heuristik-Plan ohne LLM. Schalt einen LLM-Key frei für individuelle Angebote.",
    jobs,
    total_credits: jobs.reduce((s, j) => s + j.credits, 0),
    generated_by: "heuristic",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}
