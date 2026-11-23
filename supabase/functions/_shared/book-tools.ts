import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const bookSearchSchema = z.object({ query: z.string().trim().min(1).max(250), album: z.string().trim().min(1).max(200).optional(), limit: z.number().int().min(1).max(100).optional() }).strict();

export async function searchBookProductions(db: SupabaseClient, input: unknown) {
  const args = bookSearchSchema.parse(input);
  const { data, error } = await db.rpc('search_book_productions', { p_query: args.query, p_album: args.album ?? null, p_limit: args.limit ?? 20 });
  if (error) throw error;
  const results = [];
  for (const row of data ?? []) {
    let thumbnail: string | null = null;
    const raw = row.thumbnail as string | null;
    if (raw) {
      const storage = raw.match(/\/storage\/v1\/(?:object\/(?:public\/|authenticated\/|sign\/)?|render\/image\/(?:public|authenticated|sign)\/)([^/]+)\/([^?]+)/);
      if (storage || !/^https?:\/\//.test(raw)) {
        const signed = await db.storage.from(storage?.[1] || 'book-productions').createSignedUrl(decodeURIComponent(storage?.[2] || raw), 60, { transform: { width: 600, height: 600, resize: 'contain', quality: 70 } });
        if (!signed.error) thumbnail = signed.data?.signedUrl ?? null;
      }
    }
    results.push({ id: row.id, album: row.album, title: row.title, tags: row.tags, notes: row.notes, thumbnail });
  }
  return results;
}