// oauth-cloud
// HTTP POST mit Auth-Header. Aktionen:
//   action='start_drive'    → erzeugt Google-OAuth-URL mit Drive-File-Scope
//   action='exchange'       → tauscht Auth-Code gegen Refresh+Access-Token (Drive)
//   action='refresh_drive'  → erneuert Access-Token aus Refresh-Token
//   action='connect_gist'   → speichert GitHub-PAT, legt privaten Gist an
//   action='disconnect'     → kappt Cloud-Verbindung

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Nicht angemeldet" }, 401);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Token ungültig" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  // ── start_drive ────────────────────────────────────────────────────────
  if (action === "start_drive") {
    if (!clientId) return json({ error: "GOOGLE_OAUTH_CLIENT_ID fehlt — Plattform-Betreiber muss OAuth-Client einrichten" }, 500);
    const redirect = `${body.app_origin}/auth/cloud-callback?provider=gdrive`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
      state: user.id,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  // ── exchange ───────────────────────────────────────────────────────────
  if (action === "exchange") {
    if (!clientId || !clientSecret) return json({ error: "Google OAuth Secrets fehlen" }, 500);
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        grant_type: "authorization_code",
        redirect_uri: body.redirect_uri,
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) {
      return json({ error: j.error_description || `Exchange ${r.status}` }, 502);
    }

    const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${j.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Earth 0.1 Notes",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const folder = await folderRes.json();
    if (!folderRes.ok) return json({ error: `Folder: ${folder.error?.message}` }, 502);

    await supabase.from("profiles").update({
      cloud_provider: "gdrive",
      gdrive_refresh_token: j.refresh_token,
      gdrive_folder_id: folder.id,
    }).eq("id", user.id);

    return json({ ok: true, folderId: folder.id });
  }

  // ── refresh_drive ──────────────────────────────────────────────────────
  if (action === "refresh_drive") {
    if (!clientId || !clientSecret) return json({ error: "Google OAuth Secrets fehlen" }, 500);
    const { data: profile } = await supabase
      .from("profiles")
      .select("gdrive_refresh_token")
      .eq("id", user.id)
      .single();
    if (!profile?.gdrive_refresh_token) return json({ error: "Kein Refresh-Token" }, 400);

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.gdrive_refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: j.error || `Refresh ${r.status}` }, 502);
    return json({ access_token: j.access_token, expires_in: j.expires_in });
  }

  // ── connect_gist ───────────────────────────────────────────────────────
  if (action === "connect_gist") {
    const pat: string = body.pat;
    if (!pat || (!pat.startsWith("ghp_") && !pat.startsWith("github_pat_"))) {
      return json({ error: "PAT muss mit ghp_ oder github_pat_ anfangen" }, 400);
    }
    const r = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "Earth 0.1 Notes",
        public: false,
        files: { "README.md": { content: "Earth 0.1 — Notizen-Container. Bitte nichts manuell ändern." } },
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.id) return json({ error: j.message || `Gist-Create ${r.status}` }, 502);

    await supabase.from("profiles").update({
      cloud_provider: "gist",
      github_pat: pat,
      github_gist_id: j.id,
    }).eq("id", user.id);
    return json({ ok: true, gistId: j.id });
  }

  // ── disconnect ─────────────────────────────────────────────────────────
  if (action === "disconnect") {
    await supabase.from("profiles").update({
      cloud_provider: null,
      gdrive_refresh_token: null,
      gdrive_folder_id: null,
      github_pat: null,
      github_gist_id: null,
    }).eq("id", user.id);
    // Vektor-Einträge bleiben erst mal — wenn der User eine neue Cloud verbindet,
    // kann er via Re-Index alles neu aufbauen. Wenn er dauerhaft trennt, werden
    // sie beim nächsten Load self-healing entfernt.
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
