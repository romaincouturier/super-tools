import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "st-chunk-reload";

/**
 * `lazy()` durci contre les échecs de chargement de chunk.
 *
 * Symptôme corrigé : après un déploiement (ou avec un ancien Service Worker /
 * cache navigateur), le fichier JS demandé n'existe plus. L'import dynamique
 * échoue et l'apprenant reste bloqué sur un écran de chargement qui tourne
 * indéfiniment.
 *
 * Stratégie : une nouvelle tentative après 600 ms, puis un rechargement forcé
 * (une seule fois par session, pour éviter toute boucle) qui repart sur le
 * dernier index.html.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await factory();
      } catch (err2) {
        let alreadyReloaded = true;
        try {
          alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
          if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch {
          /* storage indisponible : on ne recharge pas */
        }
        if (!alreadyReloaded) {
          window.location.reload();
          // Laisse le temps au reload de partir sans afficher d'erreur.
          await new Promise((r) => setTimeout(r, 5000));
        }
        throw err2 ?? err;
      }
    }
  });
}
