import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookDownloadFilename, downloadBookProduction } from './bookDownloads';
import type { BookProduction } from '@/types/book';

const mocks = vi.hoisted(() => ({ download: vi.fn(), resolve: vi.fn(), sign: vi.fn(), single: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/file-utils', () => ({ downloadFile: mocks.download }));
vi.mock('@/lib/storageUrl', () => ({ resolveStorageUrl: mocks.resolve, getSignedUrl: mocks.sign }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
const production = {
  title: 'Mon dessin', original_filename: 'IMG_123.jpeg', file_url: 'https://storage.test/original.jpeg',
  thumbnail_url: 'https://storage.test/thumb.webp', source_media_id: null,
} as BookProduction;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockImplementation(async (url) => url + '?signed');
  mocks.download.mockResolvedValue(undefined);
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.single }) }) });
});

describe('Téléchargements des originaux book', () => {
  it('utilise le titre et l’extension originale, sans duplication', () => {
    expect(bookDownloadFilename('Mon dessin', 'IMG.JPEG', production.file_url)).toBe('Mon dessin.JPEG');
    expect(bookDownloadFilename('Mon dessin.jpeg', 'IMG.JPEG', production.file_url)).toBe('Mon dessin.jpeg');
  });
  it('extrait l’extension de l’URL sans sa signature', () => {
    expect(bookDownloadFilename('Vidéo', null, 'https://storage.test/vid%C3%A9o.mp4?token=a#t=1')).toBe('Vidéo.mp4');
  });
  it('télécharge file_url et jamais thumbnail_url', async () => {
    await downloadBookProduction(production);
    expect(mocks.resolve).toHaveBeenCalledWith(production.file_url);
    expect(mocks.download).toHaveBeenCalledWith(production.file_url + '?signed', 'Mon dessin.jpeg');
  });
  it('lit l’original de la médiathèque sous les droits de la session', async () => {
    mocks.single.mockResolvedValue({ data: { file_url: 'https://storage.test/media.png', file_name: 'source.png' }, error: null });
    await downloadBookProduction({ ...production, source_media_id: 'media-id' });
    expect(mocks.from).toHaveBeenCalledWith('media');
    expect(mocks.download).toHaveBeenCalledWith('https://storage.test/media.png?signed', 'Mon dessin.png');
  });
  it('ne contourne pas un refus de lecture du média', async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error('Accès refusé') });
    await expect(downloadBookProduction({ ...production, source_media_id: 'media-id' })).rejects.toThrow('Accès refusé');
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('signe les chemins bruts du book', async () => {
    mocks.sign.mockResolvedValue('https://storage.test/signed.png');
    await downloadBookProduction({ ...production, file_url: 'album/file.png' });
    expect(mocks.sign).toHaveBeenCalledWith('book-productions', 'album/file.png');
    expect(mocks.download).toHaveBeenCalledWith('https://storage.test/signed.png', 'Mon dessin.jpeg');
  });
});