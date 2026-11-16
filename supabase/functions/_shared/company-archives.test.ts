import { describe, expect, it, vi } from 'vitest';
import { archiveCompanyFile, decodeArchiveBase64, expiringArchiveDocuments, validateArchiveMetadata } from './company-archives';
import { archiveGmailAttachments, selectArchiveAttachments } from './company-archive-email';

const input = { file_name: 'certificat.pdf', mime_type: 'application/pdf', category: 'Qualiopi', valid_until: '2027-11-16' };
function mockDb(fail = false) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'new-document', file_name: input.file_name }, error: fail ? { message: 'refus' } : null }) }) });
  const remove = vi.fn(); const update = vi.fn();
  return { db: { storage: { from: () => ({ upload, remove, getPublicUrl: () => ({ data: { publicUrl: 'https://storage.invalid/admin-archives/documents/test' } }) }) }, from: () => ({ insert, update }) }, upload, insert, remove, update };
}
describe('archives entreprise additives', () => {
  it('stocke une nouvelle version avec upsert=false, catégorie et validité', async () => {
    const { db, upload, insert, remove, update } = mockDb();
    await archiveCompanyFile(db, input, new Uint8Array([1, 2]));
    await archiveCompanyFile(db, input, new Uint8Array([3, 4]));
    expect(upload.mock.calls[0][2]).toEqual({ contentType: 'application/pdf', upsert: false });
    expect(upload.mock.calls[0][0]).not.toBe(upload.mock.calls[1][0]);
    expect(insert.mock.calls[0][0]).toMatchObject({ category: 'Qualiopi', valid_until: '2027-11-16', analysis_status: 'done' });
    expect(remove).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('ne supprime même pas le fichier si le référencement échoue', async () => {
    const { db, remove } = mockDb(true);
    await expect(archiveCompanyFile(db, input, new Uint8Array([1]))).rejects.toThrow('non référencé');
    expect(remove).not.toHaveBeenCalled();
  });
  it('la validité est facultative', () => expect(() => validateArchiveMetadata({ ...input, valid_until: undefined })).not.toThrow());
  it('refuse une date impossible avant upload', async () => {
    const { db, upload } = mockDb();
    await expect(archiveCompanyFile(db, { ...input, valid_until: '2026-02-30' }, new Uint8Array([1]))).rejects.toThrow('Date');
    expect(upload).not.toHaveBeenCalled();
  });
  it('décode exactement les octets base64', () => expect([...decodeArchiveBase64('AAEC/w==')]).toEqual([0, 1, 2, 255]));
  it('refuse base64 invalide', () => expect(() => decodeArchiveBase64('%%%')).toThrow('Base64'));
  it('refuse un fichier au-delà de 20 Mo avant upload', async () => {
    const { db, upload } = mockDb();
    await expect(archiveCompanyFile(db, input, new Uint8Array(20 * 1024 * 1024 + 1))).rejects.toThrow('20 Mo');
    expect(upload).not.toHaveBeenCalled();
  });
  it('signale aujourd’hui à J+30 uniquement, sans validité vide', () => {
    const rows = [null, '2026-11-15', '2026-11-16', '2026-12-16', '2026-12-17'].map(valid_until => ({ valid_until }));
    expect(expiringArchiveDocuments(rows, '2026-11-16').map(x => x.valid_until)).toEqual(['2026-11-16', '2026-12-16']);
  });
});
const payload = { parts: [{ filename: 'certificat.pdf', mimeType: 'application/pdf', body: { attachmentId: 'cert', size: 2 } }, { filename: 'logo.png', mimeType: 'image/png', body: { attachmentId: 'logo', size: 2 } }] };
describe('pièces jointes Gmail sélectionnées', () => {
  it('sélectionne toutes les pièces si aucun filtre', () => expect(selectArchiveAttachments(payload)).toHaveLength(2));
  it('refuse un nom introuvable avant toute écriture', () => expect(() => selectArchiveAttachments(payload, ['absent.pdf'])).toThrow('introuvable'));
  it('ne télécharge et archive que les pièces choisies', async () => {
    const { db, insert } = mockDb();
    const get = vi.fn(async (path: string) => path.includes('format=full') ? { payload } : { data: 'AAE=' });
    const result = await archiveGmailAttachments(db, { ...input, gmail_message_id: 'abcdef123456', attachment_filenames: ['certificat.pdf'] }, get);
    expect(result.complete).toBe(true); expect(result.documents).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).not.toHaveBeenCalledWith('/users/me/messages/abcdef123456/attachments/logo');
    expect(insert.mock.calls[0][0]).toMatchObject({ source_gmail_message_id: 'abcdef123456' });
  });
  it('remonte une erreur partielle sans effacer les réussites', async () => {
    const { db, remove } = mockDb();
    const get = vi.fn(async (path: string) => { if (path.endsWith('/logo')) throw new Error('Gmail [403]'); return path.includes('format=full') ? { payload } : { data: 'AAE=' }; });
    const result = await archiveGmailAttachments(db, { ...input, gmail_message_id: 'abcdef123456' }, get);
    expect(result.documents).toHaveLength(1); expect(result.complete).toBe(false);
    expect(result.errors).toEqual([{ file_name: 'logo.png', error: 'Gmail [403]' }]); expect(remove).not.toHaveBeenCalled();
  });
});