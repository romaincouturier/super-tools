import { resolveContentType } from '@/lib/file-utils';

const MAX_SIDE = 900;

async function blobToThumbnail(source: Blob, name: string): Promise<File | null> {
  const image = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) return null;
  return new File([blob], `${name.replace(/\.[^/.]+$/, '')}-thumb.jpg`, { type: 'image/jpeg' });
}

export async function createThumbnailFile(file: File): Promise<File | null> {
  if (!resolveContentType(file).startsWith('image/')) return null;
  return blobToThumbnail(file, file.name);
}

export async function createThumbnailFromUrl(url: string, name: string): Promise<File | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return blobToThumbnail(await res.blob(), name);
}
