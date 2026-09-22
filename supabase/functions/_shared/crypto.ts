/**
 * Cryptographic utilities
 */

/**
 * Generate a SHA-256 hash of a string, returned as hex
 */
export async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a SHA-256 hash of an ArrayBuffer, returned as hex
 */
export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparaison de secrets en temps constant. Compare les digests SHA-256 des
 * deux entrees : la duree ne depend ni de la position du premier octet
 * different, ni de la longueur des secrets. A utiliser pour verifier un secret
 * de webhook / secret partage a la place de `!==`, afin de supprimer le
 * canal auxiliaire temporel (timing attack).
 */
export async function timingSafeEqualSecret(
  a: string | null | undefined,
  b: string | null | undefined,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a ?? "")),
    crypto.subtle.digest("SHA-256", encoder.encode(b ?? "")),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/**
 * Extract client IP from request headers (Cloudflare, proxies, etc.)
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}
