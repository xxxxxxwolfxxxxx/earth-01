// Tool-Handler werden vom telegram-webhook aufgerufen.
// Jede Funktion bekommt (params, ctx) und gibt einen string mit dem Tool-Ergebnis zurück.

export interface ToolContext {
  supabase: any;
  user_id: string;
  agent: any;        // Aktiver Agent (mit personality, llm_api_key Zugang)
  profile: any;      // Profile-Row inkl. Keys
}

// ─── Pattern A: user_lists CRUD ───────────────────────────────────

type ListAction = "add" | "list" | "remove" | "done" | "today";

async function listCrud(
  ctx: ToolContext,
  list_type: "shopping" | "family" | "symptom" | "diary" | "project",
  params: any,
  itemField: string,
): Promise<string> {
  const action = (params.action as ListAction) ?? "list";
  const item = (params[itemField] as string) ?? params.content ?? "";

  if (action === "add") {
    if (!item) return "Fehlt: was soll ich hinzufügen?";
    await ctx.supabase.from("user_lists").insert({
      user_id: ctx.user_id,
      list_type,
      content: item,
    });
    return `Hinzugefügt: ${item}`;
  }
  if (action === "remove" || action === "done") {
    if (!item) return "Fehlt: was soll ich entfernen?";
    await ctx.supabase
      .from("user_lists")
      .delete()
      .eq("user_id", ctx.user_id)
      .eq("list_type", list_type)
      .ilike("content", `%${item}%`);
    return `Entfernt: Einträge die "${item}" enthalten`;
  }
  if (action === "today") {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await ctx.supabase
      .from("user_lists")
      .select("content, created_at")
      .eq("user_id", ctx.user_id)
      .eq("list_type", list_type)
      .gte("created_at", `${today}T00:00:00Z`)
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) return "Heute noch keine Einträge.";
    return data.map((r: any) => `• ${r.content}`).join("\n");
  }
  // list (default)
  const { data } = await ctx.supabase
    .from("user_lists")
    .select("content, created_at")
    .eq("user_id", ctx.user_id)
    .eq("list_type", list_type)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data || data.length === 0) return "Liste ist leer.";
  return data.map((r: any) => `• ${r.content}`).join("\n");
}

export const handleShoppingList = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "shopping", params, "item");

export const handleFamilyMemory = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "family", params, "content");

export const handleSymptomTracker = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "symptom", params, "symptom");

export const handleDiary = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "diary", params, "entry");

export const handleProjectManager = (params: any, ctx: ToolContext) =>
  listCrud(ctx, "project", params, "task");

// ─── Pattern B: Web/API zero-key ─────────────────────────────────

export async function handleWebSearch(params: any, _ctx: ToolContext): Promise<string> {
  const query = (params.query as string)?.trim();
  if (!query) return "Brauche eine Suchanfrage.";
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await r.json();
    const abs = data.AbstractText || data.Heading || "";
    const url = data.AbstractURL || "";
    if (!abs) {
      const topic = (data.RelatedTopics ?? [])[0]?.Text ?? "";
      if (topic) return topic;
      return `Keine direkte Antwort für "${query}". Versuche Wikipedia.`;
    }
    return url ? `${abs}\n\n${url}` : abs;
  } catch (e) {
    return `Suche fehlgeschlagen: ${(e as Error).message}`;
  }
}

export async function handleTravelInfo(params: any, ctx: ToolContext): Promise<string> {
  const query = (params.query as string)?.trim();
  if (!query) return "Brauche ein Ziel oder eine Routenfrage.";
  return handleWebSearch({ query: `Reise ${query}` }, ctx);
}

export async function handleWeather(params: any, _ctx: ToolContext): Promise<string> {
  const location = (params.location as string)?.trim();
  if (!location) return "Brauche einen Ort.";
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de`
    );
    const gj = await geo.json();
    const place = gj.results?.[0];
    if (!place) return `Ort "${location}" nicht gefunden.`;
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
    );
    const wxj = await wx.json();
    const c = wxj.current ?? {};
    return `${place.name}, ${place.country}: ${c.temperature_2m}°C, Wind ${c.wind_speed_10m} km/h (Code ${c.weather_code}).`;
  } catch (e) {
    return `Wetter-Abfrage fehlgeschlagen: ${(e as Error).message}`;
  }
}

// ─── Pattern C: LLM-Template Tools ───────────────────────────────

async function callLLM(profile: any, system: string, user: string): Promise<string> {
  const baseUrl = profile.llm_base_url || "https://integrate.api.nvidia.com/v1";
  const apiKey = profile.llm_api_key;
  const model = profile.llm_model || "moonshotai/kimi-k2.5";
  if (!apiKey) return "Bitte erst einen LLM-Key in den Einstellungen hinterlegen.";
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 512, temperature: 0.6,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) return `LLM-Fehler ${r.status}`;
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() ?? "(keine Antwort)";
}

export const handleRecipeHelper = (params: any, ctx: ToolContext) => {
  const ingredients = Array.isArray(params.ingredients) ? params.ingredients : [];
  if (ingredients.length === 0) return Promise.resolve("Brauche mindestens eine Zutat.");
  const sys = "Du bist ein Koch. Schlage genau ein Rezept vor das nur die genannten Zutaten + Wasser/Salz/Pfeffer braucht. Format: Kurzer Name, Zutaten-Mengen, 3-5 Schritte.";
  return callLLM(ctx.profile, sys, `Zutaten: ${ingredients.join(", ")}`);
};

export const handleDecisionHelper = (params: any, ctx: ToolContext) => {
  const options = Array.isArray(params.options) ? params.options : [];
  const criteria = Array.isArray(params.criteria) ? params.criteria : [];
  if (options.length < 2) return Promise.resolve("Mindestens 2 Optionen nötig.");
  const sys = "Du hilfst bei Entscheidungen. Erstelle eine kurze Pro/Contra-Liste pro Option und gib eine Empfehlung mit Begründung. Maximal 200 Wörter.";
  return callLLM(ctx.profile, sys,
    `Optionen: ${options.join(", ")}\nKriterien: ${criteria.length > 0 ? criteria.join(", ") : "allgemein"}`);
};

export const handlePriceCompare = (params: any, ctx: ToolContext) => {
  const product = (params.product as string)?.trim();
  if (!product) return Promise.resolve("Welches Produkt?");
  const sys = "Du bist ein Preis-Berater. Schätze typische Preisspanne für das Produkt im Jahr 2026 (DACH-Markt). Nenne 2-3 Kategorien (Discount / Mittelklasse / Premium) mit Preisspanne. Disclaimer am Ende: 'Schätzung, vergleiche aktuelle Online-Preise.'";
  return callLLM(ctx.profile, sys, product);
};

export const handleSecurityCheck = (params: any, ctx: ToolContext) => {
  const text = (params.text as string)?.trim();
  if (!text) return Promise.resolve("Was soll ich prüfen?");
  const sys = "Du bist ein Security-Berater. Analysiere den Text auf Phishing-Indikatoren, Passwort-Schwächen oder verdächtige URLs. Antworte strukturiert: Risiko (gering/mittel/hoch), Begründung, Empfehlung.";
  return callLLM(ctx.profile, sys, text);
};

export const handleTranslator = (params: any, ctx: ToolContext) => {
  const text = (params.text as string)?.trim();
  const target = (params.target as string)?.trim() ?? "en";
  if (!text) return Promise.resolve("Was soll ich übersetzen?");
  const sys = `Übersetze in ${target}. Antworte NUR mit der Übersetzung, ohne Anführungszeichen, ohne Erklärung.`;
  return callLLM(ctx.profile, sys, text);
};

export const handleMultiAgentChat = async (params: any, ctx: ToolContext) => {
  const question = (params.question as string)?.trim();
  if (!question) return "Was soll ich fragen?";
  const { data: family } = await ctx.supabase
    .from("agents")
    .select("id,name,display_name,personality,generation")
    .eq("owner_id", ctx.user_id)
    .eq("alive", true)
    .neq("id", ctx.agent.id)
    .limit(3);
  if (!family || family.length === 0) {
    return "Du hast aktuell keine anderen lebenden Familien-Mitglieder.";
  }
  const answers: string[] = [];
  for (const member of family) {
    const sys = `Du bist ${member.display_name ?? member.name} (Gen ${member.generation}). Persönlichkeit: ${JSON.stringify(member.personality)}. Antworte kurz aus dieser Perspektive (max 2 Sätze).`;
    const ans = await callLLM(ctx.profile, sys, question);
    answers.push(`💬 ${member.display_name ?? member.name}: ${ans}`);
  }
  return answers.join("\n\n");
};

export const handleMathEval = (params: any, _ctx: ToolContext): Promise<string> => {
  const expr = (params.expression as string)?.trim() ?? "";
  if (!expr) return Promise.resolve("Brauche eine Expression.");
  if (!/^[\d+\-*/().,\s\eE]+$/.test(expr)) {
    return Promise.resolve("Nur einfache Math-Expressions erlaubt (+,-,*,/,(,)).");
  }
  try {
    const result = new Function(`return (${expr.replace(/,/g, ".")});`)();
    if (typeof result !== "number" || !isFinite(result)) {
      return Promise.resolve("Ergebnis ist keine endliche Zahl.");
    }
    return Promise.resolve(`= ${result}`);
  } catch (e) {
    return Promise.resolve(`Parse-Fehler: ${(e as Error).message}`);
  }
};

export const handlePersonalityStyle = (_params: any, _ctx: ToolContext) =>
  Promise.resolve("personality_style wird automatisch im Hintergrund angewendet.");

// ─── Pattern E: External Keys ────────────────────────────────────

export async function handleImageGenerate(params: any, ctx: ToolContext): Promise<string> {
  const prompt = (params.prompt as string)?.trim();
  if (!prompt) return "Brauche einen Prompt.";
  const key = ctx.profile.huggingface_key;
  if (!key) return "Hinterlege erst einen kostenlosen Hugging-Face-Key in den Einstellungen.";
  try {
    const r = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt }),
      }
    );
    if (!r.ok) return `Image-API-Fehler ${r.status}`;
    const buf = new Uint8Array(await r.arrayBuffer());
    const path = `${ctx.user_id}/${Date.now()}.png`;
    const { error: upErr } = await ctx.supabase.storage
      .from("generated-images").upload(path, buf, { contentType: "image/png" });
    if (upErr) return `Upload-Fehler: ${upErr.message}`;
    const { data } = ctx.supabase.storage.from("generated-images").getPublicUrl(path);
    return `Bild generiert: ${data.publicUrl}`;
  } catch (e) {
    return `Generierung fehlgeschlagen: ${(e as Error).message}`;
  }
}

export async function handleEmailSend(params: any, ctx: ToolContext): Promise<string> {
  const to = (params.to as string)?.trim();
  const subject = (params.subject as string)?.trim();
  const body = (params.body as string)?.trim();
  if (!to || !subject || !body) return "Brauche to, subject, body.";
  const key = ctx.profile.resend_api_key;
  if (!key) return "Hinterlege erst einen Resend-Key in den Einstellungen.";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [to], subject, text: body,
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      return `Email-Fehler ${r.status}: ${errBody.slice(0,200)}`;
    }
    return `Email gesendet an ${to}.`;
  } catch (e) {
    return `Versand fehlgeschlagen: ${(e as Error).message}`;
  }
}
