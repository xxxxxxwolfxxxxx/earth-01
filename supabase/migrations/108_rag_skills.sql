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
 'Browser liest die Datei, extrahiert Text, legt sie in deiner Cloud ab und erstellt Vektor-<span class="term">Embedding</span>s.',
 '0', '["gdrive_connect"]'::jsonb, '["huggingface_key"]'::jsonb, NULL, 560, 730, 42),

-- ── LLM-PFAD ─────────────────────────────────────────────────────────────
('embed_setup', 'Embeddings einrichten', '🧮', 'llm', 'config', 'konfig',
 'Aktiviert die Vektor-Suche für deine Notizen. Notwendig für /frag und Auto-Recall.',
 'Wir prüfen deinen Hugging-Face-Key und embedden alle bisherigen Notizen einmal initial via <span class="term">multilingual-e5</span>.',
 '0', '["gdrive_connect"]'::jsonb, '["huggingface_key"]'::jsonb, NULL, 280, 860, 50),

('ask_memory', 'Erinnerung abrufen', '🧠', 'llm', 'llm', 'action',
 '„/frag wann hab ich Anna getroffen" — der Bot durchsucht deine Notizen und antwortet aus dem Kontext.',
 '<span class="term">RAG</span> in Aktion: deine Frage wird embedded, Top-5 ähnliche Notizen via <span class="term">Cosine-Similarity</span> geholt, Sprachmodell antwortet anhand der Snippets.',
 '~500', '["embed_setup"]'::jsonb, '["llm_api_key"]'::jsonb,
 '(?i)(?:^|\s)(?:/frag|frag)\s+(.+)$', 420, 860, 51),

('auto_recall', 'Auto-Erinnerung', '✨', 'llm', 'llm', 'action',
 'Stell Freitext-Fragen ohne „/frag". Wenn der Bot in deinen Notizen was findet, antwortet er von selbst.',
 'Bei Nachrichten ohne Skill-Match: Top-Treffer-Score wird gegen eine Schwelle geprüft. Nur bei Sicherheit wird geantwortet, sonst Standard-Antwort.',
 '~500', '["ask_memory"]'::jsonb, '["llm_api_key"]'::jsonb, NULL, 560, 860, 52),

('prompt_template', 'Prompt-Editor', '💬', 'llm', 'script', 'browser',
 'Pass den System-<span class="term">Prompt</span> für RAG-Antworten an deinen Stil an.',
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
