import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { archiveClient } from '../company-archives';
import { ARCHIVE_MAX_BYTES } from '../../../../supabase/functions/_shared/company-archives';
import { result } from '../supabase';

export default defineTool({
  name: 'read_company_document', title: 'Lire un document entreprise',
  description: 'Retourne les métadonnées et le fichier base64 (20 Mo maximum) par document_id, après vérification des droits administrateur et téléchargement authentifié. Aucune URL publique ni écriture.',
  inputSchema: { document_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ document_id }, ctx) => {
    const db = await archiveClient(ctx);
    const { data: doc, error } = await db.from('admin_documents').select('id,file_name,mime_type,file_size,category,valid_until,summary,storage_path,file_url').eq('id', document_id).single();
    if (error || !doc) throw new Error(error?.message || 'Document introuvable');
    if (doc.file_size && doc.file_size > ARCHIVE_MAX_BYTES) throw new Error('Lecture base64 limitée à 20 Mo');
    const path = doc.storage_path || doc.file_url.split('/admin-archives/')[1]?.split('?')[0];
    if (!path || path.includes('..')) throw new Error('Chemin du document invalide');
    const { data: blob, error: downloadError } = await db.storage.from('admin-archives').download(path);
    if (downloadError || !blob) throw new Error(downloadError?.message || 'Téléchargement impossible');
    if (blob.size > ARCHIVE_MAX_BYTES) throw new Error('Lecture base64 limitée à 20 Mo');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return result({ id: doc.id, file_name: doc.file_name, mime_type: doc.mime_type, category: doc.category, valid_until: doc.valid_until, summary: doc.summary, file_base64: btoa(binary) });
  },
});