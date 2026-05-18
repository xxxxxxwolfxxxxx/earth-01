import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { name, personality } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 30) {
    return new Response(JSON.stringify({ error: "Name ungültig (1-30 Zeichen)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keys = ["priority", "social_mode", "risk_tolerance", "curiosity", "cooperation"];
  if (!personality || typeof personality !== "object") {
    return new Response(JSON.stringify({ error: "Personality-Objekt fehlt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  for (const k of keys) {
    const v = personality[k];
    if (typeof v !== "number" || v < 0 || v > 1) {
      return new Response(JSON.stringify({ error: `${k} muss eine Zahl zwischen 0 und 1 sein` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { count } = await supabaseAdmin
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("alive", true);

  if ((count ?? 0) >= 2) {
    return new Response(JSON.stringify({ error: "Maximal 2 lebende Agenten pro Spieler" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: ws } = await supabaseAdmin.from("world_state").select("grid_size").single();
  const gridSize = ws?.grid_size ?? 30;

  const { data: tilesRow } = await supabaseAdmin.from("world_tiles").select("tiles").single();
  const tiles = tilesRow?.tiles ?? "";

  let x = -1, y = -1;
  const seed = Date.now();
  for (let attempt = 0; attempt < 100; attempt++) {
    const tryX = ((seed * (attempt + 7)) % gridSize + gridSize) % gridSize;
    const tryY = ((seed * (attempt + 13) * 3) % gridSize + gridSize) % gridSize;
    const idx = tryY * gridSize + tryX;
    const tile = tiles[idx];
    if (tile === "e" || tile === "f") {
      x = tryX;
      y = tryY;
      break;
    }
  }
  if (x === -1) {
    x = Math.floor(Math.random() * gridSize);
    y = Math.floor(Math.random() * gridSize);
  }

  const maxAge = 2000 + Math.floor(Math.random() * 800);

  const { data: agent, error: insertError } = await supabaseAdmin
    .from("agents")
    .insert({
      owner_id: user.id,
      name: name.trim(),
      personality,
      x,
      y,
      energy: 80,
      max_age: maxAge,
      generation: 0,
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(agent), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
