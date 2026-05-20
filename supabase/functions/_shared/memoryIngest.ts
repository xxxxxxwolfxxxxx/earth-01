// Eine Notiz in User-Cloud speichern + Vektor-Eintrag anlegen.

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

  const cloudPath = await adapter.save(noteId, args.text);

  let vec: number[];
  try {
    vec = await embedPassage(args.text, args.hfKey);
  } catch (e) {
    // Cloud-Save rollback bei Embedding-Fehler
    try { await adapter.delete(cloudPath); } catch { /* best effort */ }
    throw e;
  }

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
    try { await adapter.delete(cloudPath); } catch { /* best effort */ }
    throw new Error(`Index-Insert: ${error.message}`);
  }

  return { noteId, cloudPath };
}
