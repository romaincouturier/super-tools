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
