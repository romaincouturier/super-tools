import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { archiveClient, archiveMetadata } from '../company-archives';
import { result } from '../supabase';

export default defineTool({
  name: 'archive_email_attachments', title: 'Archiver des pièces jointes Gmail',
  description: 'Archive dans les archives entreprise les pièces jointes du Gmail connecté (boîte partagée Romain). attachment_filenames omis = toutes ; sinon noms exacts sélectionnés. Catégorie requise, validité facultative. Aucun email envoyé, remplacement ou suppression ; résultat détaillé et erreurs partielles. Ne pas réessayer automatiquement.',
  inputSchema: { gmail_message_id: z.string().trim().min(1).max(300), attachment_filenames: z.array(z.string().min(1).max(255)).min(1).max(50).optional(), ...archiveMetadata },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    const db = await archiveClient(ctx);
    const { data, error } = await db.functions.invoke('archive-company-email', { body: input });
    if (error) {
      const response = 'context' in error ? error.context : null;
      throw new Error(response instanceof Response ? await response.text() : error.message);
    }
    return result(data);
  },
});