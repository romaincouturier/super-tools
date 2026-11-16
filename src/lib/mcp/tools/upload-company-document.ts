import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { archiveClient, archiveMetadata } from '../company-archives';
import { archiveCompanyFile, decodeArchiveBase64 } from '../../../../supabase/functions/_shared/company-archives';
import { result } from '../supabase';

export default defineTool({
  name: 'upload_company_document', title: 'Archiver un document entreprise',
  description: 'Ajoute un fichier base64 (20 Mo maximum) aux Archives administratives, avec catégorie et validité facultative. Jamais de remplacement, suppression, analyse automatique ni email ; chaque ajout est journalisé.',
  inputSchema: { file_name: z.string().min(1).max(255), mime_type: z.string().max(120), file_base64: z.string().min(1).max(27962028), ...archiveMetadata },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => result(await archiveCompanyFile(await archiveClient(ctx), input, decodeArchiveBase64(input.file_base64))),
});