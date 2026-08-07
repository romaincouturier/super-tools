import { supabase } from "@/integrations/supabase/client";

/** Buckets that are private and therefore require a signed URL to be read. */
const PRIVATE_BUCKETS = new Set([
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

/** Open a stored file in a new tab, resolving signed URLs when needed. */
export async function openStorageUrl(url: string) {
  const resolved = await resolveStorageUrl(url);
  const a = document.createElement("a");
  a.href = resolved;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
