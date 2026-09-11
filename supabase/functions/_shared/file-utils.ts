import { mimeTypeFromFileName } from "./mime-types.ts";

/** Remove diacritics and sanitize a filename for safe storage paths. */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

/** Resolve content type from file.type or extension. Falls back to application/octet-stream. */
export function resolveContentType(file: File, fallback = "application/octet-stream"): string {
  if (file.type) return file.type.toLowerCase().split(";")[0].trim();
  return mimeTypeFromFileName(file.name, fallback);
}

/**
 * Types MIME acceptés par le bucket `media` (médiathèque). Storage rejette tout
 * le reste avec une erreur opaque : on vérifie en amont pour renvoyer un
 * message clair (415) plutôt qu'un 500.
 */
export const MEDIA_BUCKET_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/heic", "image/heif", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-aac",
  "audio/ogg", "audio/x-caf", "audio/flac", "audio/webm",
  "application/pdf",
]);

export const MEDIA_UNSUPPORTED_MESSAGE =
  "Ce format de fichier n'est pas accepté dans la médiathèque. Formats acceptés : images, vidéos, audio et PDF. Pour un PowerPoint, un Word ou un Excel, passez par les documents de la mission ou de la formation.";

/** `true` si le type MIME est stockable dans le bucket `media`. */
export function isMediaBucketMime(contentType: string): boolean {
  return MEDIA_BUCKET_MIME_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}
