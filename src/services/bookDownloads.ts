import { supabase } from '@/integrations/supabase/client';
import { downloadFile } from '@/lib/file-utils';
import { getSignedUrl, resolveStorageUrl } from '@/lib/storageUrl';
import type { BookProduction } from '@/types/book';

export function bookDownloadFilename(title: string, originalName: string | null, url: string): string {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const extension = (originalName ?? '').match(/\.[a-z0-9]+$/i)?.[0]
    ?? path.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
  const name = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'Production';
  return extension && !name.toLowerCase().endsWith(extension.toLowerCase()) ? name + extension : name;
}

export async function downloadBookProduction(production: BookProduction): Promise<void> {
  let url = production.file_url;
  let originalName = production.original_filename;
  if (production.source_media_id) {
    const { data, error } = await supabase.from('media')
      .select('file_url, file_name').eq('id', production.source_media_id).single();
    if (error) throw error;
    url = data.file_url;
    originalName = data.file_name;
  }
  const resolved = /^https?:\/\//i.test(url)
    ? await resolveStorageUrl(url)
    : await getSignedUrl('book-productions', url);
  if (!resolved) throw new Error('Fichier introuvable ou accès refusé');
  await downloadFile(resolved, bookDownloadFilename(production.title, originalName, url));
}