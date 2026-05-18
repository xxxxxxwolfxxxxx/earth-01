import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [stateRes, tilesRes, agentsRes, eventsRes] = await Promise.all([
    supabase.from("world_state").select("*").single(),
    supabase.from("world_tiles").select("tiles").single(),
    supabase.from("agents").select("id, name, x, y, energy, age, max_age, alive, day_phase, personality, reputation, imprisoned_until, generation, owner_id, uses_own_llm, created_at").eq("alive", true),
    supabase.from("world_events").select("*").order("tick", { ascending: false }).limit(20),
  ]);

  const error = stateRes.error || tilesRes.error || agentsRes.error || eventsRes.error;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      worldState: stateRes.data,
      tiles: tilesRes.data?.tiles ?? "",
      agents: agentsRes.data ?? [],
      events: eventsRes.data ?? [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
