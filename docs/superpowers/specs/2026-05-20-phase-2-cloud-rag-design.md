# Phase 2 — Cloud-Storage + RAG mit Notizen

**Status:** Brainstormed, awaiting plan
**Vorgänger:** Phase 1 MVP (Tech-Tree, 20 Skills, /keys, /provider, Telegram-Webhook, Whisper)
**Datum:** 2026-05-20

---

## Ziel in einem Satz

Der User kann seine eigenen Notizen, Stimmungen, Gewohnheiten und (optional) Konversationen und
hochgeladene Dateien als „erweitertes Gedächtnis" nutzen — der Bot beantwortet Fragen wie
„wann hab ich Anna getroffen" oder „was war die Idee von letztem Donnerstag" aus den eigenen Daten.

## Designprinzipien

1. **Privacy-by-Default:** Klartext bleibt auf User-eigenem Cloud-Speicher (Google Drive oder GitHub Gist), nur Vektor-Embeddings und Metadaten liegen in Supabase.
2. **Free-Tier-tauglich:** Embeddings über Hugging Face (gratis, multilingual). pgvector ist in Supabase Postgres eingebaut, kein Zusatz-Account.
3. **Provider-agnostisch:** Cloud-Adapter mit Interface — Drive & Gist heute, OneDrive/Dropbox/etc. später ohne Refactor.
4. **User-konfigurierbar:** Welche Datenquellen indiziert werden, ist jederzeit per Toggle einstellbar.
5. **Tech-Tree-konsistent:** Neue Funktionen werden zu Skills, die der User explizit freischaltet und dabei das dahinterliegende Konzept (RAG, Embeddings, OAuth, Vektor-DB) lernt.

## Hybrid-Architektur

```
                    ┌──────────────────────┐
                    │  User schreibt Notiz │
                    └──────────┬───────────┘
                               │
                               ▼
                  ┌─────────────────────────┐
                  │  telegram-webhook       │
                  │  Edge Function          │
                  └──────────┬──────────────┘
                             │
              ┌──────────────┼─────────────────────┐
              │              │                     │
              ▼              ▼                     ▼
    ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
    │ Cloud-Adapt. │  │ HF Embedding │  │ pgvector Index     │
    │ Drive / Gist │  │ multilingual │  │ notes_embeddings   │
    │              │  │ -e5-small    │  │                    │
    │ Klartext     │  │ 384-dim      │  │ Vektor + cloud_path│
    └──────────────┘  └──────────────┘  └────────────────────┘
       User-eigen        HF-Server         Supabase (RLS)
```

**Bei einer Frage** (`/frag wann hab ich Anna getroffen`):
1. Frage durch HF-Embedding → 384-dim Vektor
2. `pgvector` Cosine-Similarity-Suche → Top-5 ähnlichste `note_ids`
3. Für jede ID: Cloud-Adapter lädt den Klartext
4. LLM-Prompt: "Beantworte diese Frage anhand der mitgelieferten Notizen: ..." + Snippets
5. Antwort zurück. Optional transparent: „Aus diesen 3 Notizen: ..."

**Pro Frage:** ~3-4 s Latenz (HF-Embed 2 s + parallele Cloud-Fetches 0.5 s + LLM 1 s). Akzeptabel für „Magic-Moment"-Feature.

## Datenquellen — vom User wählbar

Profile-Feld `rag_sources` (JSONB-Array) bestimmt welche Quellen indiziert werden:

| Source-Type | Beschreibung | Default |
|---|---|---|
| `note` | Explizite Notiz via `/notiz` oder `notiz: ...` | aktiv |
| `mood` | Stimmungs-Tracker-Einträge | aus |
| `habit` | Gewohnheits-Logs | aus |
| `conversation` | Alle Telegram-Nachrichten | aus |
| `file` | Hochgeladene PDF/MD/TXT | aus |

User kann die Liste auf der neuen `/data`-Seite anpassen. Beim Aktivieren einer neuen Quelle
läuft ein Re-Index für historische Daten dieses Typs.

## Cloud-Adapter (Provider-agnostisch)

Interface (TypeScript):

```ts
interface CloudAdapter {
  init(profile: Profile): Promise<void>            // OAuth-Token vorbereiten
  save(noteId: string, text: string): Promise<string>  // gibt cloud_path zurück
  load(cloudPath: string): Promise<string>
  delete(cloudPath: string): Promise<void>
  list(): Promise<{ path: string; modified: Date }[]>
}
```

**Implementierungen ab Start:**
- `GoogleDriveAdapter` — App-Folder „Earth 0.1", eine Datei pro Notiz, Filename = UUID.txt
- `GitHubGistAdapter` — Ein privater Gist pro User, jede Notiz als Datei im selben Gist

**Vorbereitet für später** (gleiche Interface): OneDrive, Dropbox, S3-kompatibel, lokales File-System via Tauri.

## Datenbank-Erweiterung (Migration 107)

```sql
-- pgvector aktivieren (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Notiz-Index: NUR Embeddings + Metadata, KEIN Klartext
CREATE TABLE public.notes_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  cloud_path TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('note','mood','habit','conversation','file')),
  preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_embeddings_user_idx ON public.notes_embeddings(user_id);
CREATE INDEX notes_embeddings_vec_idx ON public.notes_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.notes_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own embeddings" ON public.notes_embeddings
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Profile erweitern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cloud_provider TEXT,
  ADD COLUMN IF NOT EXISTS github_gist_id TEXT,
  ADD COLUMN IF NOT EXISTS rag_sources JSONB DEFAULT '["note"]'::jsonb;
-- gdrive_refresh_token, gdrive_folder_id, github_pat existieren schon
```

## Neue Edge-Function-Module

`supabase/functions/_shared/`:

| Datei | Verantwortung |
|---|---|
| `cloudAdapters.ts` | Interface + GoogleDriveAdapter + GitHubGistAdapter. Picker am Profile-Feld `cloud_provider`. |
| `embedding.ts` | `embed(text) → number[]` via HF `multilingual-e5-small`. Session-Cache. |
| `memoryIngest.ts` | `ingestNote(userId, text, sourceType) → noteId`. Speichert Cloud + Vektor in einem Aufruf. |
| `ragQuery.ts` | `findRelevant(userId, query, topK=5) → { text, score, noteId }[]`. Embedding + pgvector + Cloud-Fetch. |

`supabase/functions/telegram-webhook/index.ts` wird erweitert:
- Bei Note-Speicherung (z.B. notes-Skill, mood-Skill mit aktiver `rag_sources`-Quelle): zusätzlich `memoryIngest()` aufrufen
- `/frag <Query>` als neuer Skill-Match: `ragQuery()` + LLM-Antwort
- Impliziter Fallback: Wenn kein Skill matcht UND `auto_recall` freigeschaltet → `ragQuery()` versuchen, antworten nur wenn Treffer-Score > Schwelle

`supabase/functions/oauth-cloud/` (NEU): Edge Function die OAuth-Refresh für Drive/Gist macht und Token-Lifecycle handhabt.

## Neue Skills (Tech-Baum)

### Cloud-Pfad — NEU (cyan, color #06b6d4)

| skill_id | Name | Icon | Typ | Pattern (für action) |
|---|---|---|---|---|
| `gdrive_connect` | Google Drive verbinden | 📁 | konfig | — |
| `gist_connect` | GitHub Gist verbinden | 🐙 | konfig | — |
| `file_upload` | Datei zum Erinnern | 📤 | browser | — |

### LLM-Pfad — NEU (amber, color #f59e0b)

| skill_id | Name | Icon | Typ | Pattern |
|---|---|---|---|---|
| `embed_setup` | Embeddings einrichten | 🧮 | konfig | — |
| `ask_memory` | Erinnerung abrufen | 🧠 | action | `(?i)(/frag\|^frag\s)` |
| `auto_recall` | Auto-Erinnerung | ✨ | action | impliziter Fallback |
| `prompt_template` | Prompt-Editor | 💬 | browser | — |

**Voraussetzungs-Ketten:**
- `gist_connect` und `gdrive_connect`: brauchen `api_keys` + `telegram` (Hub)
- `file_upload`: braucht eine Cloud-Verbindung
- `embed_setup`: braucht `huggingface_key` (im keys-Service) + eine Cloud-Verbindung
- `ask_memory` + `auto_recall`: brauchen `embed_setup`
- `prompt_template`: braucht `embed_setup`

## Neue Frontend-Seite `/data`

Übersichtsseite für Cloud + RAG:
- **Status-Karten**: Cloud verbunden ja/nein (Drive/Gist), Embeddings aktiv, Notizen-Anzahl im Index
- **Quellen-Toggle**: Checkboxen für `note`, `mood`, `habit`, `conversation`, `file`. Speichert in `profiles.rag_sources`
- **Re-Index-Button**: Forciert komplette Neu-Embedding aller Daten in der Cloud (z.B. nach Quellen-Änderung)
- **Cloud trennen**: Löscht OAuth-Token + alle `notes_embeddings`-Zeilen (Klartext in User-Cloud bleibt, User kann selbst aufräumen)

## Wissens-Seite-Erweiterung

Neuer Abschnitt „RAG & Embeddings — wie der Bot dich versteht":
- Was ist ein Embedding (Visualisierung: Wörter als Punkte im Raum)
- Was ist Cosine-Similarity
- Warum braucht's eine Vektor-DB
- Wie funktioniert OAuth (kurz)
- Trade-Off „bei mir vs schnell" — warum Hybrid

Glossar-Einträge ergänzen: `Vektor-DB`, `pgvector`, `Cosine-Similarity`, `OAuth-Scopes`,
`multilingual-e5`, `Re-Indexing`.

## Performance-Annahmen

- Pro User durchschnittlich 100-500 Notizen → notes_embeddings ~200 KB-1 MB pro User
- Bei 2000 aktiven Usern: 0.4-2 GB DB → passt auf Supabase Free-Tier (500 MB) für ~500 User; für mehr User: Migration zu Supabase Pro nötig oder Vektoren in Upstash auslagern (gesondertes Phase 3 Thema)
- HF-Rate-Limit: ~30 Calls/Min. Bei einer aktiven User-Session selten Problem (1 Frage = 1 Call).
- Cloud-Fetch-Latenz: Drive ~500 ms/Datei, Gist ~300 ms/Datei. Parallel-Fetch der Top-5 → 600-800 ms.

## Fehler-Verhalten

| Fehlerfall | Was passiert |
|---|---|
| Cloud-Token abgelaufen | OAuth-Refresh-Versuch. Bei Fehler: Banner auf `/data`, Bot antwortet „Cloud nicht erreichbar" |
| HF-Embedding-API down | Bot antwortet „Mein Gedächtnis ist gerade nicht ansprechbar, probier später nochmal" |
| Notiz in Cloud gelöscht aber Vektor existiert noch | Beim Fetch 404 → Vektor wird gelöscht (self-healing) |
| `rag_sources` enthält Quelle ohne Cloud | Quelle wird ignoriert, Warnung auf `/data` |
| User verlässt die Plattform | Profile-Cascade löscht `notes_embeddings`. Klartext in User-Cloud bleibt. |

## Reihenfolge der Implementierung (grob)

1. DB-Migration 107 (pgvector + notes_embeddings + profiles-Erweiterung)
2. `cloudAdapters.ts` mit GoogleDriveAdapter (OAuth, save, load, list)
3. `embedding.ts` mit HF-Integration
4. `memoryIngest.ts` + `ragQuery.ts`
5. Edge Function `oauth-cloud` für Refresh-Handling
6. `telegram-webhook` erweitern: Ingestion + `/frag` + auto_recall
7. GitHubGistAdapter
8. Skill-Katalog Migration: 7 neue Skills, 2 neue Pfade
9. Frontend `/data`-Seite
10. Lesson-Seite: setupHints für neue konfig-Skills
11. Wissen-Seite: RAG-Abschnitt + neue Glossar-Begriffe
12. Smoke-Test End-to-End

## Was wir bewusst NICHT in Phase 2 machen

- Cross-User-Suche („gleiches Thema bei anderen Usern") — Privacy-Bruch, sparen wir auf
- Voice-Note als Notiz-Quelle — geht bereits via Whisper-Transkription + notes-Skill
- Bild-Embeddings (CLIP) — eigenes Teilprojekt
- Real-Time-Realtime-Index-Updates über mehrere Geräte — Telegram bleibt der Eingang
- Multi-Tenancy-Tweaks (Shared-Notizen zwischen Familien-Accounts) — wenn jemand danach fragt

---

**Nächster Schritt:** Implementierungsplan via `superpowers:writing-plans` erstellen.
