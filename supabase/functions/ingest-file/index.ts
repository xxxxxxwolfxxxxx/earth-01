// ingest-file
// HTTP POST mit Auth-Header. Body: { text, filename }. Speichert in User-Cloud
// + erstellt Vektor-Eintrag in notes_embeddings (source_type='file').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestNote } from "../_shared/memoryIngest.ts";
import { CloudConfig } from "../_shared/cloudAdapters.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function buildCloudConfig(supabase: any, profile: any): Promise<CloudConfig> {
  if (profile.cloud_provider === "gdrive") {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: profile.gdrive_refresh_token, grant_type: "refresh_token",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Drive-Refresh: ${j.error_description ?? j.error}`);
    return { provider: "gdrive", gdriveAccessToken: j.access_token, gdriveFolderId: profile.gdrive_folder_id };
  }
  if (profile.cloud_provider === "gist") {
    return { provider: "gist", githubPat: profile.github_pat, githubGistId: profile.github_gist_id };
  }
  throw new Error("Keine Cloud konfiguriert");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const { text, filename } = body;
  if (!text || typeof text !== "string") return json({ error: "text fehlt" }, 400);
  if (text.length > 200_000) return json({ error: "Datei zu groß (Limit 200k Zeichen)" }, 400);

  const { data: profile } = await supabase
    .from("profiles")
    .select("huggingface_key, cloud_provider, gdrive_refresh_token, gdrive_folder_id, github_pat, github_gist_id")
    .eq("id", user.id).single();
  if (!profile) return json({ error: "Profil nicht gefunden" }, 404);
  if (!profile.huggingface_key) return json({ error: "Erst Hugging-Face-Key hinterlegen" }, 400);
  if (!profile.cloud_provider) return json({ error: "Erst Cloud verbinden" }, 400);

  try {
    const cloudConfig = await buildCloudConfig(supabase, profile);
    // Optional: filename in den Klartext als erste Zeile mit reinpacken — hilft RAG
    const annotated = filename ? `[Datei: ${filename}]\n\n${text}` : text;
    const result = await ingestNote({
      supabase, userId: user.id, text: annotated,
      sourceType: "file", hfKey: profile.huggingface_key, cloudConfig,
    });
    return json({ ok: true, noteId: result.noteId });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
