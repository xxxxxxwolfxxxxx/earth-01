-- 109_rag_glossary.sql
-- Glossar-Einträge für die neuen RAG- und Cloud-Konzepte.

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
