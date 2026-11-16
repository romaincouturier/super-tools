export const COMPANY_ARCHIVE_CATEGORIES = ['Qualiopi', 'Administratif', 'Juridique', 'Facture', 'Contrat', 'RH / Paie', 'Fiscal', 'Bancaire', 'Assurance', 'Légal', 'Formation', 'Commercial', 'Divers'] as const;
export const ARCHIVE_MAX_BYTES = 20 * 1024 * 1024;
export type ArchiveInput = { file_name: string; mime_type: string; category: string; valid_until?: string; source_gmail_message_id?: string };

export function validateArchiveMetadata(input: ArchiveInput) {
  if (!input.file_name?.trim() || input.file_name.length > 255) throw new Error('Nom de fichier requis (255 caractères maximum)');
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(input.mime_type)) throw new Error('Type MIME invalide');
  if (!(COMPANY_ARCHIVE_CATEGORIES as readonly string[]).includes(input.category)) throw new Error('Catégorie invalide');
  if (input.valid_until) {
    const d = new Date(`${input.valid_until}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.valid_until) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input.valid_until) throw new Error('Date de validité invalide (AAAA-MM-JJ)');
  }
}

export function decodeArchiveBase64(value: string) {
  if (!value || value.length > Math.ceil(ARCHIVE_MAX_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Base64 invalide ou fichier supérieur à 20 Mo');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > ARCHIVE_MAX_BYTES) throw new Error('Fichier vide ou supérieur à 20 Mo');
  return bytes;
}

// deno-lint-ignore no-explicit-any
export async function archiveCompanyFile(db: any, input: ArchiveInput, bytes: Uint8Array) {
  validateArchiveMetadata(input);
  if (!bytes.length || bytes.length > ARCHIVE_MAX_BYTES) throw new Error('Fichier vide ou supérieur à 20 Mo');
  const id = crypto.randomUUID();
  const path = `documents/${id}_${input.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: uploadError } = await db.storage.from('admin-archives').upload(path, bytes, { contentType: input.mime_type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await db.from('admin_documents').insert({ id, file_name: input.file_name, mime_type: input.mime_type, category: input.category, valid_until: input.valid_until || null, file_size: bytes.length, storage_path: path, file_url: db.storage.from('admin-archives').getPublicUrl(path).data.publicUrl, source_gmail_message_id: input.source_gmail_message_id || null, analysis_status: 'done', year: Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date())) }).select('id,file_name,category,valid_until,file_size').single();
  if (error) throw new Error(`Fichier stocké mais non référencé (${id}) : ${error.message}. Ne pas réessayer automatiquement.`);
  return data;
}

export function expiringArchiveDocuments<T extends { valid_until: string | null }>(rows: T[], today: string) {
  const boundary = new Date(`${today}T12:00:00Z`);
  boundary.setUTCDate(boundary.getUTCDate() + 30);
  const end = boundary.toISOString().slice(0, 10);
  return rows.filter(row => row.valid_until && row.valid_until >= today && row.valid_until <= end);
}

// deno-lint-ignore no-explicit-any
export async function fetchExpiringArchives(db: any, today: string) {
  const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 30);
  const rows: { id: string; file_name: string; valid_until: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('admin_documents').select('id,file_name,valid_until').gte('valid_until', today).lte('valid_until', end.toISOString().slice(0, 10)).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}