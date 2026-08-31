/**
 * Table MIME unique du projet, indexée par extension.
 *
 * Les fonctions qui écrivent un fichier quelque part (pièce jointe d'email,
 * upload storage, sauvegarde Drive) doivent toutes lire ici : un type absent
 * d'une copie locale se traduit par un fichier illisible côté destinataire.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  zip: "application/zip",
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  // Médias
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

/** Type MIME déduit de l'extension, `fallback` si l'extension est inconnue. */
export function mimeTypeFromFileName(
  filename: string,
  fallback = "application/octet-stream",
): string {
  const parts = filename.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  return MIME_BY_EXTENSION[ext] || fallback;
}

/**
 * Variante pour les pièces jointes CRM : une extension inconnue y est presque
 * toujours un PDF.
 */
export function guessMimeType(filename: string): string {
  return mimeTypeFromFileName(filename, "application/pdf");
}
