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
