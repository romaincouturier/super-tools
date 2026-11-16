import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { archiveClient, archiveMetadata } from '../company-archives';
import { result } from '../supabase';

export default defineTool({
  name: 'list_company_documents', title: 'Lister les archives entreprise',
  description: 'Retrouve les documents des Archives administratives par catégorie ou nom, avec id, taille, validité et résumé. Pagination par offset ; utiliser read_company_document pour récupérer le fichier.',
  inputSchema: { category: archiveMetadata.category.optional(), search: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, search, limit, offset }, ctx) => {
    const db = await archiveClient(ctx);
    let q = db.from('admin_documents').select('id,file_name,file_size,mime_type,category,valid_until,summary,tags,uploaded_at').order('uploaded_at', { ascending: false }).order('id').range(offset, offset + limit - 1);
    if (category) q = q.eq('category', category);
    if (search) q = q.ilike('file_name', `%${search.replace(/[%,]/g, '')}%`);
    const { data, error } = await q;
    if (error) throw error;
    return result({ documents: data || [], next_offset: data?.length === limit ? offset + limit : null });
  },
});