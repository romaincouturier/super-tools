import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/storageUrl";

/**
 * Renvoie une URL affichable pour un fichier stocké. Les buckets privés
 * (book-productions, crm-attachments...) exposent des URLs "public" héritées
 * qui renvoient une 400 : on les remplace par une URL signée temporaire.
 */
export function useResolvedStorageUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url ?? null);

  useEffect(() => {
    if (!url) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    setResolved(url);
    resolveStorageUrl(url)
      .then((next) => {
        if (!cancelled) setResolved(next);
      })
      .catch(() => {
        /* on garde l'URL d'origine */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}
