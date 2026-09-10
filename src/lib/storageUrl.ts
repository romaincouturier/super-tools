import { supabase } from "@/integrations/supabase/client";

/** Buckets that are private and therefore require a signed URL to be read. */
const PRIVATE_BUCKETS = new Set([
  "book-productions",
  "crm-attachments",
  "devis-pdfs",
  "participant-files",
  "training-documents",
]);

/** Extract bucket + path from a Supabase storage URL (public, sign or authenticated form). */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

/**
 * Resolve a stored storage URL into a usable URL.
 * Legacy rows hold public URLs for buckets that are now private: for those we
 * mint a short-lived signed URL. Any other URL is returned as-is.
 */
export async function resolveStorageUrl(url: string, expiresIn = 3600): Promise<string> {
  const info = parseStorageUrl(url);
  if (!info || !PRIVATE_BUCKETS.has(info.bucket)) return url;
  const { data } = await supabase.storage.from(info.bucket).createSignedUrl(info.path, expiresIn);
  return data?.signedUrl || url;
}

/** Signed URL for a bucket + path pair. */
export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/**
 * Turn a (possibly signed and expiring) storage URL back into its stable
 * canonical `/object/public/<bucket>/<path>` form, so persisted HTML never
 * stores a token that expires.
 */
export function canonicalizeStorageUrl(url: string): string {
  const info = parseStorageUrl(url);
  if (!info) return url;
  const origin = url.split("/storage/v1/")[0];
  return `${origin}/storage/v1/object/public/${info.bucket}/${info.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Rewrite every <img src> of an HTML string with the given transform. */
function mapHtmlImageSrc(html: string, map: (src: string) => string): string {
  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/gi, (_m, a, src, b) => `${a}${map(src)}${b}`);
}

/** Strip signed tokens from images inside HTML before persisting it. */
export function canonicalizeHtmlImageUrls(html: string): string {
  return mapHtmlImageSrc(html, canonicalizeStorageUrl);
}

/** Replace private-bucket image URLs inside HTML by fresh signed URLs. */
export async function signHtmlImageUrls(html: string, expiresIn = 3600): Promise<string> {
  const srcs = Array.from(html.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi)).map((m) => m[1]);
  const targets = [...new Set(srcs)].filter((src) => {
    const info = parseStorageUrl(src);
    return !!info && PRIVATE_BUCKETS.has(info.bucket);
  });
  if (targets.length === 0) return html;

  const resolved = new Map<string, string>();
  await Promise.all(
    targets.map(async (src) => {
      resolved.set(src, await resolveStorageUrl(src, expiresIn));
    }),
  );
  return mapHtmlImageSrc(html, (src) => resolved.get(src) ?? src);
}

/** Open a stored file in a new tab, resolving signed URLs when needed. */
export async function openStorageUrl(url: string) {
  const resolved = await resolveStorageUrl(url);
  const a = document.createElement("a");
  a.href = resolved;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
