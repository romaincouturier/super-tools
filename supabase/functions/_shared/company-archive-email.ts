import { archiveCompanyFile, ARCHIVE_MAX_BYTES, validateArchiveMetadata } from './company-archives.ts';
import type { ArchiveInput } from './company-archives.ts';
import { base64UrlToBytes } from './gmail.ts';
import type { GmailPart } from './gmail.ts';

export function selectArchiveAttachments(payload: GmailPart, names?: string[]) {
  const parts: GmailPart[] = [];
  const collect = (part: GmailPart) => {
    if (part.filename && (part.body?.attachmentId || part.body?.data)) parts.push(part);
    part.parts?.forEach(collect);
  };
  collect(payload);
  if (names?.some(name => !parts.some(p => p.filename === name))) throw new Error('Pièce jointe sélectionnée introuvable ; aucun fichier archivé');
  return names ? parts.filter(p => names.includes(p.filename || '')) : parts;
}

// deno-lint-ignore no-explicit-any
export async function archiveGmailAttachments(db: any, input: { gmail_message_id: string; attachment_filenames?: string[] } & Pick<ArchiveInput, 'category' | 'valid_until'>, get: (path: string) => Promise<any>) {
  validateArchiveMetadata({ ...input, file_name: 'mail', mime_type: 'application/octet-stream' });
  let id = input.gmail_message_id.trim();
  if (!/^[0-9a-f]{10,24}$/i.test(id)) {
    const list = await get(`/users/me/messages?maxResults=1&q=${encodeURIComponent(`rfc822msgid:${id.replace(/^<|>$/g, '')}`)}`);
    id = list.messages?.[0]?.id;
    if (!id) throw new Error('Message Gmail introuvable');
  }
  const mail = await get(`/users/me/messages/${id}?format=full`);
  const parts = selectArchiveAttachments(mail.payload || {}, input.attachment_filenames);
  if (!parts.length) throw new Error('Aucune pièce jointe à archiver');
  const documents = []; const errors = [];
  for (const p of parts) {
    try {
      if ((p.body?.size || 0) > ARCHIVE_MAX_BYTES) throw new Error('Fichier supérieur à 20 Mo');
      const content = p.body?.data || (await get(`/users/me/messages/${id}/attachments/${p.body?.attachmentId}`)).data;
      documents.push(await archiveCompanyFile(db, { file_name: p.filename || 'document', mime_type: p.mimeType || 'application/octet-stream', category: input.category, valid_until: input.valid_until, source_gmail_message_id: id }, base64UrlToBytes(content || '')));
    } catch (e) { errors.push({ file_name: p.filename, error: e instanceof Error ? e.message : String(e) }); }
  }
  return { documents, errors, gmail_message_id: id, complete: errors.length === 0 };
}