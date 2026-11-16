import { z } from 'zod';
import type { ToolContext } from '@lovable.dev/mcp-js';
import { supabaseForUser } from './supabase';
import { COMPANY_ARCHIVE_CATEGORIES } from '../../../supabase/functions/_shared/company-archives';

export const archiveMetadata = {
  category: z.enum(COMPANY_ARCHIVE_CATEGORIES),
  valid_until: z.string().optional().describe('Date de validité AAAA-MM-JJ, facultative ; rappel quotidien 30 jours avant expiration.'),
};
export async function archiveClient(ctx: ToolContext) {
  const db = supabaseForUser(ctx);
  const userId = ctx.getUserId();
  if (!userId) throw new Error('Connexion requise');
  const { data, error } = await db.rpc('is_admin', { _user_id: userId });
  if (error || data !== true) throw new Error('Accès administrateur aux archives requis');
  return db;
}