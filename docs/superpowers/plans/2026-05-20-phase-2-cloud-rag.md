# Phase 2 — Cloud-Storage + RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RAG mit Notizen aufbauen: Klartext liegt auf User-Cloud (Google Drive oder GitHub Gist), Vektor-Embeddings in Supabase pgvector. User fragt seinen Telegram-Bot mit `/frag <Frage>` oder im Freitext, der Bot zieht passende Snippets aus eigenen Notizen und antwortet.

**Architecture:** Hybrid-Storage (Klartext beim User, Vektoren bei uns), Provider-agnostisches Cloud-Adapter-Interface (Drive + Gist als erste Implementierungen), HF multilingual-e5-small als Embedding-Modell, pgvector für Cosine-Similarity-Suche.

**Tech Stack:** Supabase Postgres + pgvector, Supabase Edge Functions (Deno), Hugging Face Inference API, React 19 + Vite + Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-05-20-phase-2-cloud-rag-design.md`

**Branch:** `phase-2-cloud-rag` (aus `main`)

---

## Datei-Übersicht (Neue Dateien)

| Pfad | Verantwortung |
|---|---|
| `supabase/migrations/107_rag_storage.sql` | pgvector aktivieren, notes_embeddings-Tabelle, profile-Erweiterungen |
| `supabase/migrations/108_rag_skills.sql` | 7 neue Skills, 2 neue Pfade, Tech-Tree-Layout |
| `supabase/migrations/109_rag_glossary.sql` | 6 neue Glossar-Einträge |
| `supabase/functions/_shared/cloudAdapters.ts` | Interface + Drive- und Gist-Implementierungen |
| `supabase/functions/_shared/embedding.ts` | HF-Inferenz-Wrapper |
| `supabase/functions/_shared/memoryIngest.ts` | Notiz → Cloud + Vektor |
| `supabase/functions/_shared/ragQuery.ts` | Frage → Top-K Klartext-Snippets |
| `supabase/functions/oauth-cloud/index.ts` | OAuth-Start + Refresh für Drive/Gist |
| `src/lib/cloudService.js` | Frontend-Wrapper: OAuth-Start, Status, Quellen-Toggle |
| `src/pages/Data.jsx` | Übersichtsseite `/data` |

## Modifizierte Dateien

| Pfad | Was ändert sich |
|---|---|
| `supabase/functions/telegram-webhook/index.ts` | Note-Ingestion + `/frag` + auto_recall-Fallback |
| `supabase/functions/_shared/skillHandlers.ts` | Neue Handler `skillAskMemory`, `skillAutoRecall` |
| `supabase/functions/_shared/skillRegistry.ts` | Neue Pattern für `/frag` |
| `src/pages/Lesson.jsx` | setupHints für 5 neue konfig-Skills |
| `src/pages/Knowledge.jsx` | „RAG erklärt"-Topic + Provider-Eintrag erweitern |
| `src/pages/TechTree.jsx` | PATH_META erweitern (LLM amber, Cloud cyan), LANE-Reihenfolge |
| `src/components/Navigation.jsx` | Link zu `/data` hinzufügen |
| `src/App.jsx` | Route `/data` registrieren |

---

## Task 1: DB-Migration mit pgvector + Embeddings-Tabelle

**Files:**
- Create: `supabase/migrations/107_rag_storage.sql`

- [ ] **Step 1: Branch erstellen**

```bash
cd /Users/matthiasduhrkop/Documents/earth-01
git checkout main && git pull
git checkout -b phase-2-cloud-rag
```

- [ ] **Step 2: Migration-Datei schreiben**

`supabase/migrations/107_rag_storage.sql`:

```sql
-- 107_rag_storage.sql
-- Vektor-Index für RAG-Notizen + Profil-Erweiterungen für Cloud-Storage.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.notes_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  cloud_path TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('note','mood','habit','conversation','file')),
  preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_embeddings_user_idx
  ON public.notes_embeddings(user_id);
CREATE INDEX IF NOT EXISTS notes_embeddings_vec_idx
  ON public.notes_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.notes_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own embeddings" ON public.notes_embeddings;
CREATE POLICY "Own embeddings" ON public.notes_embeddings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profil-Erweiterungen für Cloud-Storage
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cloud_provider TEXT
    CHECK (cloud_provider IS NULL OR cloud_provider IN ('gdrive','gist')),
  ADD COLUMN IF NOT EXISTS github_gist_id TEXT,
  ADD COLUMN IF NOT EXISTS rag_sources JSONB NOT NULL DEFAULT '["note"]'::jsonb;

-- gdrive_refresh_token, gdrive_folder_id, github_pat existieren bereits aus Migration 100.

-- RPC: pgvector-Suche (RLS gilt automatisch)
CREATE OR REPLACE FUNCTION public.match_notes(
  query_embedding vector(384),
  match_count INT DEFAULT 5,
  filter_user UUID DEFAULT auth.uid()
) RETURNS TABLE (
  id UUID,
  cloud_path TEXT,
  source_type TEXT,
  preview TEXT,
  similarity FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT ne.id, ne.cloud_path, ne.source_type, ne.preview,
         1 - (ne.embedding <=> query_embedding) AS similarity
  FROM public.notes_embeddings ne
  WHERE ne.user_id = filter_user
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
END $$;
```

- [ ] **Step 3: Push zur Remote-DB**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
```

Expected: `Applying migration 107_rag_storage.sql...` und `Finished supabase db push.`

- [ ] **Step 4: Verifizieren**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT extname FROM pg_extension WHERE extname='vector';
   SELECT count(*) FROM information_schema.tables WHERE table_name='notes_embeddings';
   SELECT count(*) FROM information_schema.columns
     WHERE table_name='profiles' AND column_name IN ('cloud_provider','github_gist_id','rag_sources');" --linked
```

Expected: vector-Extension vorhanden, 1 Tabelle, 3 Spalten.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/107_rag_storage.sql
git commit -m "db: Migration 107 — pgvector + notes_embeddings + profile-cols für RAG"
```

---

## Task 2: Cloud-Adapter-Interface + GoogleDriveAdapter

**Files:**
- Create: `supabase/functions/_shared/cloudAdapters.ts`

- [ ] **Step 1: Interface + Drive-Implementierung schreiben**

`supabase/functions/_shared/cloudAdapters.ts`:

```ts
// Provider-agnostisches Cloud-Storage-Interface.
// Save = neue Notiz ablegen, Load = Klartext zu cloud_path holen,
// Delete = aufräumen wenn Vektor weg ist, List = für Re-Indexing.

export interface CloudAdapter {
  save(noteId: string, text: string): Promise<string>; // returns cloud_path
  load(cloudPath: string): Promise<string>;
  delete(cloudPath: string): Promise<void>;
  list(): Promise<{ path: string; modifiedAt: string }[]>;
}

export interface CloudConfig {
  provider: "gdrive" | "gist";
  // Drive
  gdriveAccessToken?: string;   // kurzlebig, von oauth-cloud refresh'd
  gdriveFolderId?: string;
  // Gist
  githubPat?: string;
  githubGistId?: string;
}

// ─── Google Drive ──────────────────────────────────────────────────────────

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export class GoogleDriveAdapter implements CloudAdapter {
  constructor(private accessToken: string, private folderId: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async save(noteId: string, text: string): Promise<string> {
    // multipart upload mit metadata + content
    const boundary = "earth01-" + crypto.randomUUID();
    const metadata = {
      name: `${noteId}.txt`,
      parents: [this.folderId],
      mimeType: "text/plain",
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      `--${boundary}--`,
    ].join("\r\n");
    const r = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!r.ok) throw new Error(`Drive save: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return `drive:${j.id}`;
  }

  async load(cloudPath: string): Promise<string> {
    const fileId = cloudPath.replace(/^drive:/, "");
    const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!r.ok) throw new Error(`Drive load: ${r.status}`);
    return await r.text();
  }

  async delete(cloudPath: string): Promise<void> {
    const fileId = cloudPath.replace(/^drive:/, "");
    await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  async list(): Promise<{ path: string; modifiedAt: string }[]> {
    const q = encodeURIComponent(`'${this.folderId}' in parents and trashed=false`);
    const r = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,modifiedTime)`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!r.ok) throw new Error(`Drive list: ${r.status}`);
    const j = await r.json();
    return (j.files ?? []).map((f: any) => ({
      path: `drive:${f.id}`,
      modifiedAt: f.modifiedTime,
    }));
  }
}

// ─── Picker ─────────────────────────────────────────────────────────────────

export function buildAdapter(cfg: CloudConfig): CloudAdapter {
  if (cfg.provider === "gdrive") {
    if (!cfg.gdriveAccessToken || !cfg.gdriveFolderId) {
      throw new Error("Drive nicht konfiguriert");
    }
    return new GoogleDriveAdapter(cfg.gdriveAccessToken, cfg.gdriveFolderId);
  }
  // GistAdapter wird in Task 7 ergänzt.
  throw new Error(`Provider ${cfg.provider} noch nicht implementiert`);
}
```

- [ ] **Step 2: Deno-Syntax-Check via Deploy**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy telegram-webhook \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

Expected: Deploy ohne Syntax-Fehler (auch wenn das Modul noch nicht importiert wird, der `_shared`-Ordner wird gebundled).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cloudAdapters.ts
git commit -m "cloud: CloudAdapter-Interface + GoogleDriveAdapter"
```

---

## Task 3: Embedding-Modul (Hugging Face)

**Files:**
- Create: `supabase/functions/_shared/embedding.ts`

- [ ] **Step 1: Modul schreiben**

`supabase/functions/_shared/embedding.ts`:

```ts
// Embedding-Berechnung via Hugging Face Inference API.
// Modell: intfloat/multilingual-e5-small (384-dim, gut für Deutsch).

const HF_MODEL = "intfloat/multilingual-e5-small";
const HF_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

export async function embed(text: string, hfKey: string): Promise<number[]> {
  if (!hfKey) throw new Error("Kein Hugging-Face-Key");
  if (!text || !text.trim()) throw new Error("Leerer Text");

  // e5-Konvention: Queries kriegen "query: " prefix, Dokumente "passage: "
  // Wir entscheiden anhand der Länge: kurze Strings = Query, lange = Passage.
  const prefix = text.length < 80 ? "query: " : "passage: ";

  const r = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prefix + text,
      options: { wait_for_model: true },
    }),
  });
  if (!r.ok) throw new Error(`HF embed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  // HF gibt entweder ein flaches Array oder geschachtelt zurück
  const vec = Array.isArray(j[0]) ? j[0] : j;
  if (!Array.isArray(vec) || vec.length !== 384) {
    throw new Error(`Unerwartete HF-Antwort, Länge ${vec?.length}`);
  }
  return vec;
}

export async function embedQuery(text: string, hfKey: string): Promise<number[]> {
  return embed("query: " + text, hfKey);
}

export async function embedPassage(text: string, hfKey: string): Promise<number[]> {
  return embed("passage: " + text, hfKey);
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/embedding.ts
git commit -m "rag: Embedding-Modul via HF multilingual-e5-small"
```

---

## Task 4: Memory-Ingestion + RAG-Query

**Files:**
- Create: `supabase/functions/_shared/memoryIngest.ts`
- Create: `supabase/functions/_shared/ragQuery.ts`

- [ ] **Step 1: memoryIngest.ts schreiben**

`supabase/functions/_shared/memoryIngest.ts`:

```ts
// Eine Notiz: in User-Cloud speichern + Vektor-Eintrag anlegen.

import { buildAdapter, CloudConfig } from "./cloudAdapters.ts";
import { embedPassage } from "./embedding.ts";

export interface IngestArgs {
  supabase: any;             // Supabase-Client mit Service-Role
  userId: string;
  text: string;
  sourceType: "note" | "mood" | "habit" | "conversation" | "file";
  hfKey: string;
  cloudConfig: CloudConfig;
}

export async function ingestNote(args: IngestArgs): Promise<{ noteId: string; cloudPath: string }> {
  const adapter = buildAdapter(args.cloudConfig);
  const noteId = crypto.randomUUID();

  // 1. Cloud-Speicherung
  const cloudPath = await adapter.save(noteId, args.text);

  // 2. Embedding
  const vec = await embedPassage(args.text, args.hfKey);

  // 3. Index-Eintrag
  const preview = args.text.slice(0, 200);
  const { error } = await args.supabase.from("notes_embeddings").insert({
    id: noteId,
    user_id: args.userId,
    embedding: vec,
    cloud_path: cloudPath,
    source_type: args.sourceType,
    preview,
  });
  if (error) {
    // Rollback Cloud-Save
    try { await adapter.delete(cloudPath); } catch { /* best effort */ }
    throw new Error(`Index-Insert: ${error.message}`);
  }

  return { noteId, cloudPath };
}
```

- [ ] **Step 2: ragQuery.ts schreiben**

`supabase/functions/_shared/ragQuery.ts`:

```ts
// Eine Frage in Top-K Klartext-Snippets verwandeln.

import { buildAdapter, CloudConfig } from "./cloudAdapters.ts";
import { embedQuery } from "./embedding.ts";

export interface QueryArgs {
  supabase: any;
  userId: string;
  query: string;
  hfKey: string;
  cloudConfig: CloudConfig;
  topK?: number;
}

export interface QueryHit {
  noteId: string;
  cloudPath: string;
  sourceType: string;
  preview: string;
  similarity: number;
  text: string;
}

export async function findRelevant(args: QueryArgs): Promise<QueryHit[]> {
  const k = args.topK ?? 5;
  const adapter = buildAdapter(args.cloudConfig);

  const vec = await embedQuery(args.query, args.hfKey);

  const { data: matches, error } = await args.supabase.rpc("match_notes", {
    query_embedding: vec,
    match_count: k,
    filter_user: args.userId,
  });
  if (error) throw new Error(`match_notes: ${error.message}`);
  if (!matches || matches.length === 0) return [];

  // Klartext parallel aus User-Cloud holen
  const hits = await Promise.all(matches.map(async (m: any) => {
    let text = m.preview ?? "";
    try {
      text = await adapter.load(m.cloud_path);
    } catch (e) {
      // Cloud-File weg: self-heal — Vektor entfernen
      console.warn(`Cloud-Load fehlgeschlagen für ${m.cloud_path}, entferne Vektor`);
      await args.supabase.from("notes_embeddings").delete().eq("id", m.id);
      return null;
    }
    return {
      noteId: m.id,
      cloudPath: m.cloud_path,
      sourceType: m.source_type,
      preview: m.preview,
      similarity: m.similarity,
      text,
    } as QueryHit;
  }));

  return hits.filter((h): h is QueryHit => h !== null);
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/memoryIngest.ts supabase/functions/_shared/ragQuery.ts
git commit -m "rag: memoryIngest + ragQuery (Cloud + pgvector)"
```

---

## Task 5: OAuth-Cloud Edge Function (Drive-Start + Refresh)

**Files:**
- Create: `supabase/functions/oauth-cloud/index.ts`

Diese Function macht drei Dinge:
1. `action=start_drive` → erzeugt Google-OAuth-URL mit Drive-Scope, zurück zum Frontend
2. `action=exchange` → tauscht Auth-Code gegen Refresh+Access-Token (nach Google-Callback)
3. `action=refresh_drive` → erneuert Access-Token aus Refresh-Token (intern verwendet)

Vorab: Du brauchst ein **Google OAuth Client ID + Secret** mit Drive-Scope-Berechtigung. Dieses wird als Supabase-Secret hinterlegt:

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase secrets set \
  GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com \
  GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxx \
  --project-ref giyvmksetvberzrpvuhu
```

- [ ] **Step 1: Function schreiben**

`supabase/functions/oauth-cloud/index.ts`:

```ts
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

  // Auth-User
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  // ── start_drive: OAuth-URL zurückgeben ──
  if (action === "start_drive") {
    if (!clientId) return json({ error: "GOOGLE_OAUTH_CLIENT_ID fehlt im Secret" }, 500);
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

  // ── exchange: Code → Refresh + Access Token ──
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

    // App-Folder anlegen, falls noch keiner existiert
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

  // ── refresh_drive: Refresh-Token → frischer Access-Token (für serverseitige Aufrufe) ──
  if (action === "refresh_drive") {
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
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: profile.gdrive_refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: j.error || `Refresh ${r.status}` }, 502);
    return json({ access_token: j.access_token, expires_in: j.expires_in });
  }

  // ── disconnect: alles trennen ──
  if (action === "disconnect") {
    await supabase.from("profiles").update({
      cloud_provider: null,
      gdrive_refresh_token: null,
      gdrive_folder_id: null,
      github_pat: null,
      github_gist_id: null,
    }).eq("id", user.id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
```

- [ ] **Step 2: Deploy**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy oauth-cloud \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

Expected: `Deployed Functions on project ...`

- [ ] **Step 3: Smoke-Test (manuell, ohne echten OAuth-Flow)**

```bash
# Ohne Auth-Header
curl -X POST "https://giyvmksetvberzrpvuhu.supabase.co/functions/v1/oauth-cloud" \
  -H "Content-Type: application/json" \
  -d '{"action":"start_drive"}'
```

Expected: `{"error":"Nicht angemeldet"}` (HTTP 401).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/oauth-cloud/index.ts
git commit -m "oauth: oauth-cloud Edge Function für Drive-OAuth + Refresh"
```

---

## Task 6: telegram-webhook erweitert mit Ingestion + /frag

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`
- Modify: `supabase/functions/_shared/skillRegistry.ts`
- Modify: `supabase/functions/_shared/skillHandlers.ts`

- [ ] **Step 1: Pattern für `/frag` in skillRegistry**

In `supabase/functions/_shared/skillRegistry.ts` zusätzlich:

```ts
{ id: "ask_memory", pattern: /(?:^|\s)\/frag(?:\s+(.+))?$|^frag\s+(.+)$/i },
```

- [ ] **Step 2: Handler in skillHandlers.ts ergänzen**

```ts
import { findRelevant } from "./ragQuery.ts";
import { BOT } from "./botMessages.ts";

export async function skillAskMemory(ctx: SkillContext) {
  // Extrahiere Query aus der Nachricht
  const m = ctx.message.match(/(?:\/frag|^frag)\s+(.+)/i);
  const query = m?.[1]?.trim();
  if (!query) {
    return { reply: "Schreib eine Frage hinterher: /frag wann hab ich Anna getroffen" };
  }

  // Profil laden für Konfig
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("huggingface_key, cloud_provider, gdrive_folder_id, github_gist_id, github_pat, llm_api_key, llm_base_url, llm_model")
    .eq("id", ctx.user_id)
    .single();
  if (!profile?.huggingface_key) {
    return { reply: "Erst Hugging-Face-Key auf /keys hinterlegen, dann klappt /frag." };
  }
  if (!profile?.cloud_provider) {
    return { reply: "Erst eine Cloud verbinden (auf /data), dann hat /frag was zu durchsuchen." };
  }

  // Cloud-Config zusammenstellen (Access-Token via oauth-cloud holen falls Drive)
  const cloudConfig = await buildCloudConfig(ctx.supabase, ctx.user_id, profile);

  const hits = await findRelevant({
    supabase: ctx.supabase,
    userId: ctx.user_id,
    query,
    hfKey: profile.huggingface_key,
    cloudConfig,
    topK: 5,
  });
  if (hits.length === 0) {
    return { reply: "Nichts in deinen Notizen dazu gefunden." };
  }

  // LLM-Aufruf mit Snippets als Kontext
  const context = hits.map((h, i) => `(${i+1}) ${h.text}`).join("\n\n");
  const reply = await llmAnswer(profile, query, context);
  return { reply: reply + `\n\n📚 Aus ${hits.length} Notiz(en).` };
}

// Helper: Cloud-Config bauen (Drive braucht frischen Access-Token)
async function buildCloudConfig(supabase: any, userId: string, profile: any) {
  if (profile.cloud_provider === "gdrive") {
    // Internal refresh: kein HTTP-Roundtrip, direkt mit Service-Role
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const { data: p } = await supabase
      .from("profiles")
      .select("gdrive_refresh_token, gdrive_folder_id")
      .eq("id", userId).single();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: p.gdrive_refresh_token, grant_type: "refresh_token",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Drive-Refresh: ${j.error}`);
    return {
      provider: "gdrive" as const,
      gdriveAccessToken: j.access_token,
      gdriveFolderId: p.gdrive_folder_id,
    };
  }
  if (profile.cloud_provider === "gist") {
    return {
      provider: "gist" as const,
      githubPat: profile.github_pat,
      githubGistId: profile.github_gist_id,
    };
  }
  throw new Error("Keine Cloud konfiguriert");
}

async function llmAnswer(profile: any, query: string, context: string): Promise<string> {
  const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.llm_api_key}`,
    },
    body: JSON.stringify({
      model: profile.llm_model,
      messages: [
        {
          role: "system",
          content: "Du beantwortest Fragen anhand der mitgelieferten Notizen des Users. Antworte präzise auf Deutsch, nur basierend auf den Notizen. Wenn du keine Antwort hast, sag das ehrlich.",
        },
        {
          role: "user",
          content: `Frage: ${query}\n\nMitgelieferte Notizen:\n${context}`,
        },
      ],
      temperature: 0.3,
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? "(keine LLM-Antwort)";
}
```

Im `executeSkill`-Dispatcher die neue ID registrieren:

```ts
case "ask_memory": return skillAskMemory(ctx);
```

- [ ] **Step 3: Webhook erweitern — Notes-Ingestion + auto_recall**

In `supabase/functions/telegram-webhook/index.ts`:

Nach dem `executeSkill`-Block, wenn der Skill `notes`/`mood`/`habits` erfolgreich war: zusätzlich `ingestNote`, falls Quelle in `rag_sources` enthalten ist.

```ts
// Nach erfolgreichem Skill-Run, vor dem return:
if (["notes","mood","habits"].includes(skill.id)) {
  const sourceMap = { notes: "note", mood: "mood", habits: "habit" };
  const sourceType = sourceMap[skill.id];
  if ((profile.rag_sources ?? ["note"]).includes(sourceType)) {
    try {
      const cloudConfig = await buildCloudConfig(supabase, profile.id, profile);
      await ingestNote({
        supabase, userId: profile.id, text: text,
        sourceType: sourceType as any,
        hfKey: profile.huggingface_key,
        cloudConfig,
      });
    } catch (e) {
      console.warn(`Ingest failed: ${e.message}`);
      // fail silent — der Skill selbst war erfolgreich
    }
  }
}
```

Vorher Profile-Select erweitern:

```ts
.select("id, telegram_bot_token, telegram_chat_id, whisper_key, llm_api_key, llm_base_url, llm_model, huggingface_key, cloud_provider, rag_sources, gdrive_refresh_token, gdrive_folder_id, github_pat, github_gist_id")
```

Auto-Recall: Wenn `matchSkill(text)` keinen Skill findet UND User hat `auto_recall` freigeschaltet:

```ts
// Statt direkt "unknown_command" zu antworten:
if (!skill) {
  const { data: hasRecall } = await supabase
    .from("user_skills").select("skill_id")
    .eq("user_id", profile.id).eq("skill_id", "auto_recall").maybeSingle();
  if (hasRecall && profile.cloud_provider && profile.huggingface_key) {
    const cloudConfig = await buildCloudConfig(supabase, profile.id, profile);
    const hits = await findRelevant({
      supabase, userId: profile.id, query: text,
      hfKey: profile.huggingface_key, cloudConfig, topK: 3,
    });
    const top = hits[0];
    if (top && top.similarity > 0.78) {  // empirische Schwelle für e5
      const context = hits.map((h,i)=>`(${i+1}) ${h.text}`).join("\n\n");
      const reply = await llmAnswer(profile, text, context);
      await sendTelegram(profile.telegram_bot_token, msg.chat.id,
        `${reply}\n\n📚 (Aus deinen Notizen)`);
      return new Response("ok-autorecall", { headers: CORS });
    }
  }
  await sendTelegram(profile.telegram_bot_token, msg.chat.id, BOT.unknown_command());
  return new Response("ok-no-match", { headers: CORS });
}
```

- [ ] **Step 4: Deploy**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy telegram-webhook \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/telegram-webhook supabase/functions/_shared
git commit -m "rag: telegram-webhook macht Note-Ingest + /frag + auto_recall"
```

---

## Task 7: GitHubGistAdapter

**Files:**
- Modify: `supabase/functions/_shared/cloudAdapters.ts`

- [ ] **Step 1: Gist-Implementierung hinzufügen**

In `supabase/functions/_shared/cloudAdapters.ts` ergänzen:

```ts
// ─── GitHub Gist ────────────────────────────────────────────────────────────

const GIST_API = "https://api.github.com/gists";

export class GitHubGistAdapter implements CloudAdapter {
  constructor(private pat: string, private gistId: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  async save(noteId: string, text: string): Promise<string> {
    const filename = `${noteId}.txt`;
    const r = await fetch(`${GIST_API}/${this.gistId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ files: { [filename]: { content: text } } }),
    });
    if (!r.ok) throw new Error(`Gist save: ${r.status} ${await r.text()}`);
    return `gist:${filename}`;
  }

  async load(cloudPath: string): Promise<string> {
    const filename = cloudPath.replace(/^gist:/, "");
    const r = await fetch(`${GIST_API}/${this.gistId}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Gist load: ${r.status}`);
    const j = await r.json();
    const file = j.files?.[filename];
    if (!file) throw new Error(`Gist file fehlt: ${filename}`);
    // GitHub kürzt große Inhalte und liefert raw_url
    if (file.truncated && file.raw_url) {
      const raw = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${this.pat}` } });
      return await raw.text();
    }
    return file.content;
  }

  async delete(cloudPath: string): Promise<void> {
    const filename = cloudPath.replace(/^gist:/, "");
    await fetch(`${GIST_API}/${this.gistId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ files: { [filename]: null } }),
    });
  }

  async list(): Promise<{ path: string; modifiedAt: string }[]> {
    const r = await fetch(`${GIST_API}/${this.gistId}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Gist list: ${r.status}`);
    const j = await r.json();
    const updated = j.updated_at;
    return Object.keys(j.files ?? {}).map((name) => ({
      path: `gist:${name}`,
      modifiedAt: updated,
    }));
  }
}
```

Im Picker `buildAdapter`:

```ts
if (cfg.provider === "gist") {
  if (!cfg.githubPat || !cfg.githubGistId) throw new Error("Gist nicht konfiguriert");
  return new GitHubGistAdapter(cfg.githubPat, cfg.githubGistId);
}
```

- [ ] **Step 2: Gist-Connect-Action in `oauth-cloud` ergänzen**

In `supabase/functions/oauth-cloud/index.ts` neue Action:

```ts
// ── connect_gist: User pasted PAT mit "gist"-Scope, wir legen Gist an ──
if (action === "connect_gist") {
  const pat = body.pat;
  if (!pat || !pat.startsWith("ghp_") && !pat.startsWith("github_pat_")) {
    return json({ error: "PAT muss mit ghp_ oder github_pat_ anfangen" }, 400);
  }
  // Gist anlegen mit Initial-Datei
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
```

- [ ] **Step 3: Deploy + Commit**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase functions deploy oauth-cloud \
  --project-ref giyvmksetvberzrpvuhu --no-verify-jwt
git add supabase/functions
git commit -m "cloud: GitHubGistAdapter + connect_gist Action"
```

---

## Task 8: Skill-Katalog-Migration

**Files:**
- Create: `supabase/migrations/108_rag_skills.sql`

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/108_rag_skills.sql`:

```sql
-- 108_rag_skills.sql
-- 7 neue Skills in 2 neuen Pfaden: 'cloud' und 'llm'.

INSERT INTO public.skills
  (id, name, icon, path, skill_type, verification_type, description, how_it_works,
   token_cost_estimate, requires, required_keys, pattern, display_x, display_y, display_order)
VALUES
-- ── CLOUD-PFAD ───────────────────────────────────────────────────────────
('gdrive_connect', 'Google Drive verbinden', '📁', 'cloud', 'config', 'konfig',
 'Deine Notizen landen in einem eigenen Ordner auf deinem Google Drive. Wir speichern nichts Privates bei uns — nur Vektoren für die Suche.',
 'Du autorisierst per <span class="term">OAuth-Scopes</span> einen Schreibzugriff auf einen App-Folder. Wir bekommen nur ein Schreib-Token, nichts anderes.',
 '0', '["api_keys","telegram"]'::jsonb, '[]'::jsonb, NULL, 280, 730, 40),

('gist_connect', 'GitHub Gist verbinden', '🐙', 'cloud', 'config', 'konfig',
 'Alternative zu Drive: deine Notizen wandern in einen privaten GitHub Gist. Versionsiert, dev-freundlich.',
 'Du erstellst einen Personal Access Token mit Gist-Scope. Wir legen einen privaten Gist an und schreiben dort Notiz-Dateien rein.',
 '0', '["api_keys","telegram"]'::jsonb, '[]'::jsonb, NULL, 420, 730, 41),

('file_upload', 'Datei zum Erinnern', '📤', 'cloud', 'script', 'browser',
 'Lad PDFs, Markdown oder Textdateien hoch — der Bot kann später Fragen dazu beantworten.',
 'Browser liest die Datei, extrahiert Text, legt sie in deiner Cloud ab und erstellt Vektor-Embeddings.',
 '0', '["gdrive_connect"]'::jsonb, '["huggingface_key"]'::jsonb, NULL, 560, 730, 42),

-- ── LLM-PFAD ─────────────────────────────────────────────────────────────
('embed_setup', 'Embeddings einrichten', '🧮', 'llm', 'config', 'konfig',
 'Aktiviert die Vektor-Suche für deine Notizen. Notwendig für /frag und Auto-Recall.',
 'Wir prüfen deinen <span class="term">Hugging Face</span>-Key und embedden alle bisherigen Notizen einmal initial.',
 '0', '["gdrive_connect"]'::jsonb, '["huggingface_key"]'::jsonb, NULL, 280, 860, 50),

('ask_memory', 'Erinnerung abrufen', '🧠', 'llm', 'llm', 'action',
 '„/frag wann hab ich Anna getroffen" — der Bot durchsucht deine Notizen und antwortet aus dem Kontext.',
 '<span class="term">RAG</span> in Aktion: deine Frage wird embedded, Top-5 ähnliche Notizen via <span class="term">Cosine-Similarity</span> geholt, Sprachmodell antwortet anhand der Snippets.',
 '~500', '["embed_setup"]'::jsonb, '["llm_api_key"]'::jsonb,
 '(?:^|\s)\/frag(?:\s+(.+))?$|^frag\s+(.+)$', 420, 860, 51),

('auto_recall', 'Auto-Erinnerung', '✨', 'llm', 'llm', 'action',
 'Stell Freitext-Fragen ohne „/frag". Wenn der Bot in deinen Notizen was findet, antwortet er von selbst.',
 'Bei Nachrichten ohne Skill-Match: Top-Treffer-Score wird gegen eine Schwelle geprüft. Nur bei Sicherheit wird geantwortet, sonst Standard-Antwort.',
 '~500', '["ask_memory"]'::jsonb, '["llm_api_key"]'::jsonb, NULL, 560, 860, 52),

('prompt_template', 'Prompt-Editor', '💬', 'llm', 'script', 'browser',
 'Pass den System-Prompt für RAG-Antworten an deinen Stil an.',
 'Mini-Editor mit Vorschau. Lehrt <span class="term">Prompt-Engineering</span>: wie verändert sich die Antwort wenn der System-Prompt sich ändert.',
 '0', '["embed_setup"]'::jsonb, '[]'::jsonb, NULL, 700, 860, 53)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, icon = EXCLUDED.icon, path = EXCLUDED.path,
  skill_type = EXCLUDED.skill_type, verification_type = EXCLUDED.verification_type,
  description = EXCLUDED.description, how_it_works = EXCLUDED.how_it_works,
  token_cost_estimate = EXCLUDED.token_cost_estimate,
  requires = EXCLUDED.requires, required_keys = EXCLUDED.required_keys,
  pattern = EXCLUDED.pattern,
  display_x = EXCLUDED.display_x, display_y = EXCLUDED.display_y,
  display_order = EXCLUDED.display_order;
```

- [ ] **Step 2: Push + Verify**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT id, path FROM skills WHERE path IN ('cloud','llm') ORDER BY display_order" --linked
```

Expected: 7 Zeilen (3 cloud, 4 llm).

- [ ] **Step 3: TechTree-Layout im Frontend prüfen**

In `src/pages/TechTree.jsx`: `PATH_META` enthält schon `llm` (amber) und `cloud` (cyan). Lane-Reihenfolge erweitern:

```js
const pathOrder = ['daten','sicherheit','tracking','llm','automation','cloud','spielerei']
```

- [ ] **Step 4: Build + Deploy**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/108_rag_skills.sql src/pages/TechTree.jsx
git commit -m "skills: 7 neue Phase-2-Skills in cloud+llm Pfaden"
```

---

## Task 9: Frontend `/data`-Seite

**Files:**
- Create: `src/lib/cloudService.js`
- Create: `src/pages/Data.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Navigation.jsx`

- [ ] **Step 1: cloudService.js**

`src/lib/cloudService.js`:

```js
import { supabase } from './supabase'

export async function fetchCloudStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('cloud_provider, gdrive_folder_id, github_gist_id, rag_sources')
    .eq('id', user.id).single()
  const { count } = await supabase
    .from('notes_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  return { ...data, indexedCount: count ?? 0 }
}

export async function callOauthCloud(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')
  const url = import.meta.env.VITE_SUPABASE_URL
  const r = await fetch(`${url}/functions/v1/oauth-cloud`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

export async function setRagSources(sources) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  await supabase.from('profiles').update({ rag_sources: sources }).eq('id', user.id)
}
```

- [ ] **Step 2: Data.jsx**

`src/pages/Data.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Cloud, Unlink, RefreshCw, Github, LogIn, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fetchCloudStatus, callOauthCloud, setRagSources } from '../lib/cloudService'
import { useAuth } from '../contexts/AuthContext'

const SOURCE_LABELS = {
  note:         { label: 'Notizen',        emoji: '📝' },
  mood:         { label: 'Stimmungen',     emoji: '😊' },
  habit:        { label: 'Gewohnheiten',   emoji: '💪' },
  conversation: { label: 'Gespräche',      emoji: '💬' },
  file:         { label: 'Hochgeladene Dateien', emoji: '📄' },
}

export default function Data() {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [gistPat, setGistPat] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchCloudStatus().then(s => { setStatus(s); setLoading(false) })
  }, [user])

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-32 pb-16 text-center">
        <h1 className="font-display text-3xl text-white mb-4">Login benötigt</h1>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-nebula-500 text-white rounded-xl no-underline">
          <LogIn className="w-4 h-4" /> Zum Login
        </Link>
      </div>
    )
  }

  async function connectDrive() {
    setBusy(true)
    try {
      const r = await callOauthCloud({ action: 'start_drive', app_origin: window.location.origin })
      window.location.href = r.url
    } catch (e) { setMessage(`Fehler: ${e.message}`); setBusy(false) }
  }

  async function connectGist() {
    if (!gistPat.trim()) return
    setBusy(true)
    try {
      await callOauthCloud({ action: 'connect_gist', pat: gistPat.trim() })
      setStatus(await fetchCloudStatus())
      setGistPat('')
      setMessage('Gist verbunden ✓')
    } catch (e) { setMessage(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  async function disconnect() {
    if (!confirm('Cloud trennen? Dein Klartext in der Cloud bleibt, nur die Verbindung wird gekappt.')) return
    setBusy(true)
    try {
      await callOauthCloud({ action: 'disconnect' })
      setStatus(await fetchCloudStatus())
      setMessage('Cloud getrennt')
    } catch (e) { setMessage(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  async function toggleSource(src) {
    const current = status.rag_sources ?? ['note']
    const next = current.includes(src)
      ? current.filter(s => s !== src)
      : [...current, src]
    if (next.length === 0) return  // mindestens eine Quelle
    await setRagSources(next)
    setStatus(s => ({ ...s, rag_sources: next }))
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 pt-24 text-center text-gray-400">Lade…</div>

  const connected = !!status?.cloud_provider

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Database className="w-4 h-4" /> Daten + Erinnerung
        </div>
        <h1 className="font-display text-4xl font-bold text-white">Dein Gedächtnis</h1>
        <p className="text-gray-400 mt-3 text-sm max-w-xl mx-auto">
          Hier verbindest du deine Cloud und wählst, welche deiner Daten der Bot für seine Antworten nutzen darf.
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 text-blue-200 text-sm text-center">{message}</div>
      )}

      {/* Status-Karten */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className={`rounded-xl border p-4 ${connected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-white/5'}`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Cloud-Status</div>
          <div className="font-display text-xl text-white mt-1">
            {connected ? `${status.cloud_provider === 'gdrive' ? '📁 Google Drive' : '🐙 GitHub Gist'}` : 'Nicht verbunden'}
          </div>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Notizen indiziert</div>
          <div className="font-display text-xl text-blue-300 mt-1">{status?.indexedCount ?? 0}</div>
        </div>
      </div>

      {/* Cloud-Verbindung */}
      {!connected && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-400" /> Cloud verbinden
          </h2>
          <p className="text-gray-400 text-sm mb-4">Wähl einen Anbieter — du kannst später wechseln.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={connectDrive} disabled={busy}
              className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-white rounded-xl border border-blue-500/30 transition disabled:opacity-50 flex items-center justify-center gap-2">
              📁 Google Drive
            </button>
            <div className="space-y-2">
              <input type="password" value={gistPat} onChange={(e) => setGistPat(e.target.value)}
                placeholder="GitHub PAT mit gist-Scope"
                className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
              <button onClick={connectGist} disabled={busy || !gistPat}
                className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-white rounded-lg border border-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                <Github className="w-4 h-4" /> Gist anlegen
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3">
            PAT erstellen: github.com/settings/tokens → Generate new token (classic) → Scope „gist".
          </p>
        </section>
      )}

      {/* Quellen-Toggle */}
      {connected && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3">Welche Daten sollen indiziert werden?</h2>
          <p className="text-gray-400 text-xs mb-4">Mindestens eine Quelle. Toggle aktiviert nur neue Einträge — historische über Re-Index unten.</p>
          <div className="space-y-2">
            {Object.entries(SOURCE_LABELS).map(([key, meta]) => {
              const active = (status.rag_sources ?? ['note']).includes(key)
              return (
                <button key={key} onClick={() => toggleSource(key)}
                  className={`w-full p-3 rounded-lg border flex items-center gap-3 transition ${active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                  <span className="text-2xl">{meta.emoji}</span>
                  <span className="flex-1 text-left text-white">{meta.label}</span>
                  {active ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border border-white/20" />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {connected && (
        <section className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <h2 className="font-display text-white text-lg font-bold mb-2">Cloud trennen</h2>
          <p className="text-gray-400 text-sm mb-3">
            Dein Klartext in der Cloud bleibt erhalten (kannst du selbst löschen). Hier werden nur die Vektor-Einträge entfernt und der Bot verliert den Zugriff.
          </p>
          <button onClick={disconnect} disabled={busy}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg border border-red-500/30 disabled:opacity-50 flex items-center gap-2">
            <Unlink className="w-4 h-4" /> Verbindung trennen
          </button>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Route + Nav-Link**

In `src/App.jsx`:

```jsx
import Data from './pages/Data'
// ...
<Route path="/data" element={<Data />} />
```

In `src/components/Navigation.jsx`, in der `links`-Liste:

```jsx
{ to: '/data', label: 'Daten', icon: Database },
```

Import ergänzen:

```jsx
import { ..., Database } from 'lucide-react'
```

- [ ] **Step 4: Build + Deploy + Commit**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
git add src
git commit -m "ui: /data-Seite + cloudService + Nav-Eintrag"
```

---

## Task 10: Lesson-Seite setupHints für neue konfig-Skills

**Files:**
- Modify: `src/pages/Lesson.jsx`

- [ ] **Step 1: setupHints im ConfigTaskCard ergänzen**

In `src/pages/Lesson.jsx`, in `ConfigTaskCard` der `setupHints`-Map die fünf neuen konfig-Skills hinzufügen:

```js
const setupHints = {
  api_keys: { /* bestehend */ },
  telegram: { /* bestehend */ },
  rss: { /* bestehend */ },

  gdrive_connect: {
    done: !!keys.cloud_provider && keys.cloud_provider === 'gdrive',
    title: 'Google Drive verknüpfen',
    steps: [
      'Geh auf /data',
      'Klick „Google Drive"',
      'OAuth-Dialog erscheint, akzeptier den Drive-File-Scope',
      'Du landest zurück bei uns, Cloud ist verbunden',
    ],
    target: '/data',
    cta: 'Zur Daten-Seite',
  },

  gist_connect: {
    done: !!keys.cloud_provider && keys.cloud_provider === 'gist',
    title: 'GitHub Gist verknüpfen',
    steps: [
      'github.com/settings/tokens → „Generate new token (classic)"',
      'Scope „gist" auswählen, Token erstellen',
      'Auf /data Token einfügen, „Gist anlegen" klicken',
      'Wir legen einen privaten Gist als Notiz-Container an',
    ],
    target: '/data',
    cta: 'Gist verbinden',
  },

  embed_setup: {
    done: !!keys.huggingface_key && !!keys.cloud_provider,
    title: 'Embeddings aktivieren',
    steps: [
      'Hugging-Face-Key auf /keys hinterlegen (gratis bei huggingface.co/settings/tokens)',
      'Cloud verbinden (Drive oder Gist)',
      'Bisherige Notizen werden beim nächsten Schreiben oder über Re-Index in /data eingespeist',
    ],
    target: '/keys',
    cta: 'Zur Schlüssel-Zentrale',
  },
}
```

`done`-Check für `gdrive_connect`, `gist_connect` und `embed_setup` braucht zusätzliche Profile-Felder im Lesson.jsx-Fetch:

```js
.select('llm_api_key, telegram_bot_token, telegram_chat_id, huggingface_key, cloud_provider')
```

Aktualisiere `fetchUserKeys` in `src/lib/keyService.js`, das `cloud_provider` auch zurückliefert:

```js
.select(`${FETCH_COLUMNS}, telegram_webhook_secret, telegram_chat_id, telegram_linked_at, cloud_provider`)
```

- [ ] **Step 2: Build + Deploy + Commit**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
git add src/pages/Lesson.jsx src/lib/keyService.js
git commit -m "lesson: setupHints für gdrive/gist/embed_setup Skills"
```

---

## Task 11: Wissens-Seite + Glossar-Erweiterung

**Files:**
- Create: `supabase/migrations/109_rag_glossary.sql`
- Modify: `src/pages/Knowledge.jsx`

- [ ] **Step 1: Glossar-Migration**

`supabase/migrations/109_rag_glossary.sql`:

```sql
INSERT INTO public.glossary (key, icon, category, short_desc, example, related, more_skill_id) VALUES
('Vektor-DB', '📐', 'llm',
 'Datenbank die Vektoren statt Texte speichert und nach Ähnlichkeit (statt Gleichheit) durchsuchen kann. Basis für RAG.',
 'pgvector, Pinecone, Upstash Vector',
 '["RAG","Embedding","Cosine-Similarity"]'::jsonb, 'embed_setup'),

('pgvector', '🗄️', 'llm',
 'PostgreSQL-Extension, die Vektor-Spalten + Ähnlichkeitssuche ergänzt. Eingebaut in Supabase, kein Zusatzdienst nötig.',
 'CREATE EXTENSION vector;',
 '["Vektor-DB","Cosine-Similarity"]'::jsonb, 'embed_setup'),

('Cosine-Similarity', '📏', 'llm',
 'Maß für Vektor-Ähnlichkeit zwischen -1 und 1. Bei Embeddings: nahe 1 = sehr ähnlich.',
 '0.92 = klar verwandt, 0.45 = wenig gemeinsam',
 '["Vektor-DB","Embedding"]'::jsonb, NULL),

('OAuth-Scopes', '🔑', 'sicherheit',
 'Berechtigungen die eine App vom User anfragt: was darf sie tun. „drive.file" = nur eigener App-Ordner, nicht alle Drive-Dateien.',
 'drive.file, gist, repo:read',
 '["OAuth"]'::jsonb, 'gdrive_connect'),

('multilingual-e5', '🌍', 'llm',
 'Embedding-Modell, das in 100+ Sprachen ähnliche Bedeutungen erkennt. Gratis über Hugging Face.',
 'multilingual-e5-small: 384 Dimensionen',
 '["Embedding","Vektor-DB"]'::jsonb, 'embed_setup'),

('Re-Indexing', '🔄', 'llm',
 'Bestehende Texte erneut durch das Embedding-Modell jagen — z.B. nach Modell-Update oder neuen Quellen.',
 'Tausende Notizen, einmalig nach Source-Toggle',
 '["Embedding"]'::jsonb, NULL)

ON CONFLICT (key) DO UPDATE SET
  icon = EXCLUDED.icon, category = EXCLUDED.category,
  short_desc = EXCLUDED.short_desc, example = EXCLUDED.example,
  related = EXCLUDED.related, more_skill_id = EXCLUDED.more_skill_id;
```

- [ ] **Step 2: Push + Verify**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db push --linked --include-all
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT count(*) FROM glossary WHERE key IN ('Vektor-DB','pgvector','Cosine-Similarity','OAuth-Scopes','multilingual-e5','Re-Indexing');" --linked
```

Expected: count = 6.

- [ ] **Step 3: Knowledge-Seite mit neuem RAG-Topic erweitern**

In `src/pages/Knowledge.jsx`, im `TOPICS`-Array ein neues Topic nach `rag` einfügen (das `rag`-Topic existiert schon, aber kürzer als jetzt nötig — erweitern):

Such die Stelle mit `id: 'rag'`. Ersetze die `paragraphs` durch:

```js
paragraphs: [
  'Sprachmodelle haben ein Problem: sie wissen nicht, was nach ihrem Training passiert ist. GPT-4 kennt keine News von gestern. Und sie haben ein begrenztes Kontextfenster — du kannst ihnen nicht einfach 1000 Seiten Firmenwissen mitgeben.',
  'Die Lösung heißt <strong>RAG</strong> (Retrieval Augmented Generation). Idee: Du hast eine Wissensbasis (deine Notizen). Bei einer Frage suchst du nur die passenden Snippets raus und gibst sie dem Modell als Kontext mit. Frisch, präzise, ohne Halluzinationen.',
  'Wie findet man „passende Snippets"? Mit <strong>Embeddings</strong>. Ein Embedding ist ein Text als Liste von Zahlen — sodass ähnliche Texte ähnliche Zahlen haben. „Hund" und „Hündchen" liegen nah beieinander, „Hund" und „Atomreaktor" weit auseinander.',
  'Bei Earth 0.1 nutzen wir <code>multilingual-e5-small</code> von Hugging Face: 384 Dimensionen, mehrsprachig, gratis. Die Vektoren landen in <code>pgvector</code> in unserer Postgres-DB. Bei einer Frage embedde ich die Frage, suche per Cosine-Similarity die ähnlichsten 5 Notizen, und geben sie dem Sprachmodell als Kontext.',
  '<strong>Wichtig:</strong> Klartext deiner Notizen liegt nicht bei uns — sondern auf deinem Google Drive oder GitHub Gist. Wir wissen nur die Embeddings (Lossy-Transformation, nicht lesbar). So bist du privat und wir bleiben schnell.',
],
```

- [ ] **Step 4: Build + Deploy + Commit**

```bash
npx vite build && npx netlify deploy --prod --dir=dist
git add supabase/migrations/109_rag_glossary.sql src/pages/Knowledge.jsx
git commit -m "docs: RAG-Topic ausgebaut + 6 neue Glossar-Begriffe"
```

---

## Task 12: End-to-End-Smoke-Test

- [ ] **Step 1: Live-Plattform öffnen**

Öffne https://earth-01.netlify.app — eingeloggt sein.

- [ ] **Step 2: Hugging-Face-Key prüfen / hinterlegen**

Auf /keys → Hugging-Face-Token eintragen, „Speichern". Erwartet: grüne Test-Ergebnis-Karte mit „OK".

- [ ] **Step 3: Google-Drive verbinden**

Auf /data → „Google Drive" klicken. Du wirst zu Google geleitet, akzeptierst den Drive-File-Scope, kommst zurück. Erwartet: Cloud-Status zeigt „📁 Google Drive".

- [ ] **Step 4: Im Telegram eine Notiz schreiben**

In deinem Bot: `notiz: Ich treffe Anna am 23. Mai in Berlin`. Erwartet: Bot bestätigt die Notiz, im Hintergrund läuft `ingestNote`.

- [ ] **Step 5: DB-Eintrag prüfen**

```bash
SUPABASE_ACCESS_TOKEN=$SBP_TOKEN npx supabase db query \
  "SELECT count(*) FROM notes_embeddings WHERE user_id='6d2b55e3-8229-435f-9d30-4380f328c2ee';" --linked
```

Expected: count = 1.

- [ ] **Step 6: Drive-Datei prüfen**

In deinem Google Drive: Ordner „Earth 0.1 Notes" sollte eine `.txt`-Datei enthalten.

- [ ] **Step 7: /frag testen**

In Telegram: `/frag wann treffe ich Anna`. Erwartet: Bot antwortet sinngemäß „Am 23. Mai in Berlin" + `📚 Aus 1 Notiz(en).`

- [ ] **Step 8: auto_recall testen**

Im Tech-Tree: `/lesson/auto_recall` aufrufen, freischalten. Dann in Telegram: `wann ist anna in berlin`. Erwartet: Bot antwortet aus den Notizen + `(Aus deinen Notizen)`.

- [ ] **Step 9: Bug-Liste anlegen**

Was nicht funktioniert hat, in `docs/superpowers/phase-2-bugs.md` notieren. Bei kritischen Bugs: zurück zur entsprechenden Task.

- [ ] **Step 10: Final-Commit + Merge**

```bash
# Wenn alles läuft:
git checkout main
git merge phase-2-cloud-rag --no-ff -m "Merge phase-2-cloud-rag: Cloud-Storage + RAG"
git push origin main
git branch -d phase-2-cloud-rag
```

---

## Self-Review-Notiz

- **Spec-Coverage:** alle 12 Tasks aus Spec-Reihenfolge gedeckt (Migration 107, Adapters, Embedding, Ingest/Query, OAuth, Webhook, Gist, Skills, /data, Lesson-Hints, Wissen, Smoke-Test).
- **Type-Konsistenz:** `CloudConfig.provider` ist überall `"gdrive" | "gist"`, `source_type` ist überall `"note"|"mood"|"habit"|"conversation"|"file"`, `cloud_path`-Präfix `drive:` oder `gist:`.
- **Bekannte offene Punkte:**
  - Google OAuth Client-Setup (Cloud Console) ist manueller Schritt vor Task 5 — User muss dies einmalig tun.
  - Token-Refresh-Pfad fasst Service-Role-Calls und User-initiierte Calls zusammen; in Task 6 ein eigener Helper `buildCloudConfig`.
  - `file_upload`-Skill ist als browser-Skill angelegt, Implementierung der Upload-UI nicht in diesem Plan — Hinweis für Phase-2.5 oder eigene Task.
