import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/hooks/useMedia";

/**
 * Précharge les images en mémoire (blob URLs) pour garantir leur affichage
 * hors ligne tant que l'onglet reste ouvert, même si la connexion est perdue
 * en cours de présentation. Retourne une map file_url -> blob URL.
 */
export function useOfflineImageCache(items: MediaItem[], enabled: boolean) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef(new Map<string, string>());
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (item.file_type !== "image") continue;
        if (cacheRef.current.has(item.file_url) || pendingRef.current.has(item.file_url)) continue;
        pendingRef.current.add(item.file_url);
        try {
          const res = await fetch(item.file_url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          cacheRef.current.set(item.file_url, objectUrl);
          setUrls(new Map(cacheRef.current));
        } catch {
          // Réseau indisponible : on garde ce qui est déjà en cache.
        } finally {
          pendingRef.current.delete(item.file_url);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, enabled]);

  // Libère les blob URLs au démontage.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
    };
  }, []);

  return urls;
}
