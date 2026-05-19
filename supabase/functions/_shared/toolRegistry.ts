// Zentraler Tool-Katalog: Mapping tool_id → erforderliches achievement_id,
// Beschreibung für den Tools-Guide-Prompt, Rate-Limit, Key-Klasse.

export interface ToolMeta {
  tool_id: string;
  required_achievement: string;
  syntax: string;       // Beispiel-Aufruf für den LLM-Prompt
  description: string;  // Was tut das Tool
  key_class: "builtin" | "extended";
  required_key?: "llm_api_key" | "groq_api_key" | "huggingface_key" | "resend_api_key";
  rate_limit_per_day?: number;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  // Pattern B — Web/API
  { tool_id: "web_search", required_achievement: "schriftgelehrte",
    syntax: `[TOOL:web_search]{"query":"..."}[/TOOL]`,
    description: "Sucht im Web (DuckDuckGo). Antwort: kurze Zusammenfassung.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "travel_info", required_achievement: "erkunder",
    syntax: `[TOOL:travel_info]{"query":"Ziel oder Routenfrage"}[/TOOL]`,
    description: "Reise-/Routen-Infos via Web-Suche mit Travel-Kontext.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "weather", required_achievement: "wassersucher",
    syntax: `[TOOL:weather]{"location":"Stadt"}[/TOOL]`,
    description: "Aktuelle Wetterprognose (Open-Meteo).",
    key_class: "builtin", rate_limit_per_day: 30 },
  { tool_id: "translator", required_achievement: "polyglott",
    syntax: `[TOOL:translator]{"text":"...","target":"en|de|..."}[/TOOL]`,
    description: "Übersetzt Text in die Ziel-Sprache.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 50 },

  // Pattern D — Cron
  { tool_id: "reminder", required_achievement: "zeitmesser",
    syntax: `[TOOL:reminder]{"text":"...","minutes":30}[/TOOL]`,
    description: "Setzt eine Erinnerung. Telegram-Nachricht erfolgt nach den Minuten.",
    key_class: "builtin", rate_limit_per_day: 30 },
  { tool_id: "autonomous_mode", required_achievement: "weiser",
    syntax: `[TOOL:autonomous_mode]{"frequency":"weekly"}[/TOOL]`,
    description: "Aktiviert wöchentliche Selbst-Reflexion des Agenten.",
    key_class: "builtin", rate_limit_per_day: 5 },

  // Pattern A — DB-CRUD (user_lists)
  { tool_id: "shopping_list", required_achievement: "versorger",
    syntax: `[TOOL:shopping_list]{"action":"add|list|remove","item":"..."}[/TOOL]`,
    description: "Verwaltet deine Einkaufsliste.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "family_memory", required_achievement: "patriarch",
    syntax: `[TOOL:family_memory]{"action":"add|list","content":"..."}[/TOOL]`,
    description: "Speichert Notizen über Personen in deinem Leben.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "symptom_tracker", required_achievement: "heiler",
    syntax: `[TOOL:symptom_tracker]{"action":"add|list","symptom":"..."}[/TOOL]`,
    description: "Symptom-Dokumentation über Zeit.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "diary", required_achievement: "geschichtsschreiber",
    syntax: `[TOOL:diary]{"action":"add|list|today","entry":"..."}[/TOOL]`,
    description: "Tagebuch-Einträge.",
    key_class: "builtin", rate_limit_per_day: 50 },
  { tool_id: "project_manager", required_achievement: "baumeister",
    syntax: `[TOOL:project_manager]{"action":"add|list|done","task":"..."}[/TOOL]`,
    description: "Tasks & Projekte tracken.",
    key_class: "builtin", rate_limit_per_day: 100 },

  // Pattern C — LLM-Templates
  { tool_id: "recipe_helper", required_achievement: "koch",
    syntax: `[TOOL:recipe_helper]{"ingredients":["Linsen","Reis"]}[/TOOL]`,
    description: "Rezept-Vorschläge aus deinen Zutaten.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "multi_agent_chat", required_achievement: "diplomat",
    syntax: `[TOOL:multi_agent_chat]{"question":"..."}[/TOOL]`,
    description: "Fragt mehrere Familien-Mitglieder gleichzeitig nach ihrer Meinung.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 20 },
  { tool_id: "price_compare", required_achievement: "haendler",
    syntax: `[TOOL:price_compare]{"product":"..."}[/TOOL]`,
    description: "Marktanalyse zu einem Produkt.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "math_eval", required_achievement: "ingenieur",
    syntax: `[TOOL:math_eval]{"expression":"2+3*4"}[/TOOL]`,
    description: "Wertet eine Math-Expression sicher aus.",
    key_class: "builtin", rate_limit_per_day: 100 },
  { tool_id: "security_check", required_achievement: "beschuetzer",
    syntax: `[TOOL:security_check]{"text":"..."}[/TOOL]`,
    description: "Security-Analyse: Passwort-Stärke, Phishing-Erkennung.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "decision_helper", required_achievement: "gesetzgeber",
    syntax: `[TOOL:decision_helper]{"options":["A","B"],"criteria":["..."]}[/TOOL]`,
    description: "Entscheidungshilfe per Pro/Contra.",
    key_class: "extended", required_key: "llm_api_key", rate_limit_per_day: 30 },
  { tool_id: "personality_style", required_achievement: "dynastie",
    syntax: `(kein direkter Aufruf — wird automatisch als Prompt-Modifier verwendet)`,
    description: "Agent entwickelt einzigartigen Schreibstil basierend auf Achievements.",
    key_class: "builtin" },

  // Pattern E — External Keys
  { tool_id: "image_generate", required_achievement: "kuenstler",
    syntax: `[TOOL:image_generate]{"prompt":"..."}[/TOOL]`,
    description: "Bild aus Text (Hugging Face Inference API).",
    key_class: "extended", required_key: "huggingface_key", rate_limit_per_day: 10 },
  { tool_id: "email_send", required_achievement: "legende",
    syntax: `[TOOL:email_send]{"to":"...","subject":"...","body":"..."}[/TOOL]`,
    description: "Email-Versand via Resend.",
    key_class: "extended", required_key: "resend_api_key", rate_limit_per_day: 20 },
];

// Schnell-Lookup
export const TOOL_BY_ID = new Map(TOOL_REGISTRY.map((t) => [t.tool_id, t]));

// Filtert die Liste der Tools die User aktuell aufrufen darf.
export function availableToolsForUser(
  unlockedAchievementIds: Set<string>,
  userKeys: { llm_api_key?: string | null; groq_api_key?: string | null; huggingface_key?: string | null; resend_api_key?: string | null },
): ToolMeta[] {
  return TOOL_REGISTRY.filter((t) => {
    if (!unlockedAchievementIds.has(t.required_achievement)) return false;
    if (t.key_class === "extended") {
      const needed = t.required_key;
      if (!needed) return true;
      const v = (userKeys as any)[needed];
      if (!v) return false;
    }
    return true;
  });
}

// Generiert den Tools-Abschnitt für den LLM-Prompt
export function toolsGuideText(tools: ToolMeta[]): string {
  if (tools.length === 0) return "Du hast aktuell keine Werkzeuge freigeschaltet.";
  return [
    "Verfügbare Werkzeuge (immer im [TOOL:name]{...}[/TOOL] Format aufrufen):",
    ...tools.map((t) => `- ${t.tool_id}: ${t.description}\n  Beispiel: ${t.syntax}`),
  ].join("\n");
}

// Rate-Limit-Check: gibt true zurück wenn Limit erreicht ist
export async function isRateLimited(
  supabase: any,
  user_id: string,
  tool_id: string,
  limit: number,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tool_usage_log")
    .select("count")
    .eq("user_id", user_id)
    .eq("tool_id", tool_id)
    .eq("date", today)
    .single();
  return (data?.count ?? 0) >= limit;
}

export async function recordToolUsage(
  supabase: any,
  user_id: string,
  tool_id: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tool_usage_log")
    .select("count")
    .eq("user_id", user_id)
    .eq("tool_id", tool_id)
    .eq("date", today)
    .single();
  if (data) {
    await supabase
      .from("tool_usage_log")
      .update({ count: (data.count ?? 0) + 1 })
      .eq("user_id", user_id)
      .eq("tool_id", tool_id)
      .eq("date", today);
  } else {
    await supabase
      .from("tool_usage_log")
      .insert({ user_id, tool_id, date: today, count: 1 });
  }
}
