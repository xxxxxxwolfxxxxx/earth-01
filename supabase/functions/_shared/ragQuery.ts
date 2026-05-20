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
    try {
      const text = await adapter.load(m.cloud_path);
      return {
        noteId: m.id,
        cloudPath: m.cloud_path,
        sourceType: m.source_type,
        preview: m.preview,
        similarity: m.similarity,
        text,
      } as QueryHit;
    } catch (e) {
      // Cloud-File weg: self-heal — Vektor entfernen
      console.warn(`Cloud-Load fehlgeschlagen für ${m.cloud_path}, entferne Vektor`);
      await args.supabase.from("notes_embeddings").delete().eq("id", m.id);
      return null;
    }
  }));

  return hits.filter((h): h is QueryHit => h !== null);
}
