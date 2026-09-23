import { useEffect, useState } from "react";
import { isPrivateStorageUrl, resolveStorageUrl } from "@/lib/storageUrl";

/** URLs signées pour 1 h ; on les réutilise 50 min, entre montages et vignettes. */
const SIGNED_TTL_MS = 50 * 60 * 1000;
const signedCache = new Map<string, { url: string; expiresAt: number }>();

function cachedSignedUrl(url: string): string | null {
  const hit = signedCache.get(url);
  return hit && hit.expiresAt > Date.now() ? hit.url : null;
}

/**
 * Renvoie une URL affichable pour un fichier stocké. Les buckets privés
 * (book-productions, crm-attachments...) exposent des URLs "public" héritées
 * qui renvoient une 400 : on les remplace par une URL signée temporaire, et
 * on ne rend rien tant qu'elle n'est pas prête, pour ne pas déclencher la 400.
 */
export function useResolvedStorageUrl(url: string | null | undefined): string | null {
  const initial = (u: string | null | undefined) =>
    !u ? null : isPrivateStorageUrl(u) ? cachedSignedUrl(u) : u;
  const [resolved, setResolved] = useState<string | null>(() => initial(url));

  useEffect(() => {
    if (!url || !isPrivateStorageUrl(url)) {
      setResolved(url ?? null);
      return;
    }
    const cached = cachedSignedUrl(url);
    if (cached) {
      setResolved(cached);
      return;
    }
    let cancelled = false;
    setResolved(null);
    resolveStorageUrl(url)
      .then((next) => {
        if (next !== url) signedCache.set(url, { url: next, expiresAt: Date.now() + SIGNED_TTL_MS });
        if (!cancelled) setResolved(next);
      })
      .catch(() => {
        if (!cancelled) setResolved(url);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}
