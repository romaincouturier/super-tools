/**
 * Shared file utilities — single source of truth for file operations
 * used across the entire application (missions, trainings, CRM, media, etc.)
 */

/**
 * Format a file size in bytes to a human-readable French string.
 * Examples: "1.2 Mo", "340 Ko", "128 octets"
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} octets`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Sanitize a file name for safe storage: strip accents, special chars,
 * lowercase. Returns a filesystem-safe string.
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

/**
 * Download a file from a URL by fetching it as a blob and triggering
 * a browser download with the given file name.
 */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erreur de téléchargement");
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Resolve the MIME content type for a file.
 * Some browsers (iPad Safari) leave file.type empty for certain formats
 * like SVG. Falls back to extension-based detection.
 */
const EXT_TO_MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

/**
 * Build a storage path for a file upload.
 * Format: {entityType}/{entityId}/{timestamp}_{sanitizedName}
 */
export function buildStoragePath(entityType: string, entityId: string, fileName: string): string {
  return `${entityType}/${entityId}/${Date.now()}_${sanitizeFileName(fileName)}`;
}

/** Maximum upload file size in bytes (50 MB). */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Prompt the user for a new file name (preserving extension) and return the
 * result. Returns `null` if the user cancelled or the name didn't change.
 */
export function promptRenameFile(currentName: string): string | null {
  const ext = currentName.includes(".") ? currentName.slice(currentName.lastIndexOf(".")) : "";
  const nameWithoutExt = currentName.includes(".") ? currentName.slice(0, currentName.lastIndexOf(".")) : currentName;
  const newName = window.prompt("Nouveau nom du fichier :", nameWithoutExt);
  if (newName === null || newName.trim() === "" || newName.trim() === nameWithoutExt) return null;
  return newName.trim() + ext;
}

/**
 * Extract the storage file path from a public URL, given the bucket name.
 * Returns null if the bucket marker is not found in the URL.
 */
export function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const url = new URL(fileUrl);
  const marker = `/${bucket}/`;
  const idx = url.pathname.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.pathname.slice(idx + marker.length));
}
