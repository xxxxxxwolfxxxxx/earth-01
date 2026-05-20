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

-- RPC: pgvector-Suche (RLS gilt automatisch via filter_user-Default)
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
