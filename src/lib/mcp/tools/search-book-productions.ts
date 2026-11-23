import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { supabaseForUser, result } from '../supabase';
import { searchBookProductions } from '../../../../supabase/functions/_shared/book-tools';

export default defineTool({
  name: 'search_book_productions',
  title: 'Rechercher les visuels du Book',
  description: 'Recherche privée insensible aux accents et à la casse dans title, tags et notes. Retourne id, album, title, tags, notes et thumbnail signé temporairement, selon les droits du compte connecté. album accepte un UUID ou un nom partiel.',
  inputSchema: { query: z.string().trim().min(1).max(250), album: z.string().trim().min(1).max(200).optional(), limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => result(await searchBookProductions(supabaseForUser(ctx), args)),
});