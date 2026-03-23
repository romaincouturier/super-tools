
Objectif: rétablir la prod immédiatement avec un hotfix minimal, en supprimant les couches de “recovery” qui masquent le vrai problème.

Contexte confirmé
- Preview OK, publié KO: c’est un cas typique “dev server vs build chunké”.
- Le site publié renvoie actuellement une page de fallback “Erreur de chargement” (pas l’UI React normale), ce qui indique un échec de bootstrap/chunk en production.
- Do I know what the issue is? Oui: la chaîne de chargement prod est trop fragile (lazy + chunking manuel + recovery runtime), et la correction doit être structurelle, pas un nouveau contournement.

Plan hotfix direct (simplifié)

1) Stabiliser le bootstrap (source de vérité unique)
- Fichier: `src/main.tsx`
- Retirer la logique agressive de nettoyage runtime (désinscription SW/caches + hooks globaux de recovery).
- Revenir à un bootstrap React simple et déterministe: `createRoot(...).render(<App />)`.
- Garder uniquement un logging d’erreur fatal clair (sans boucle de reload automatique).

2) Supprimer la stratégie de recovery “symptôme”
- Fichiers: `src/lib/runtimeRecovery.ts`, `src/components/RouteErrorBoundary.tsx`
- Désactiver/supprimer la dépendance à `runtimeRecovery`.
- Transformer `RouteErrorBoundary` en boundary simple (message + bouton reload manuel), sans auto-clear cache ni auto-reload.
- But: éviter les boucles silencieuses et rendre l’état d’erreur observable.

3) Réduire drastiquement le risque de mismatch de chunks
- Fichier: `vite.config.ts`
- Retirer temporairement `manualChunks` (laisser Vite gérer automatiquement).
- Conserver une config build standard (minify/target OK).
- But: diminuer le nombre de chunks critiques et les risques de hash/chunk obsolètes.

4) Durcir le shell HTML (supprimer les restes PWA)
- Fichier: `index.html`
- Retirer `link rel="manifest"` + métadonnées orientées app-install qui ne servent plus en mode non-PWA.
- Garder un head minimal web standard.
- But: empêcher les comportements installables/hérités qui compliquent le cache côté client.

5) Vérifications avant publication
- Build: `npm run build` + `npx tsc --noEmit`.
- Contrôle imports cassés après simplification (runtimeRecovery retiré partout).
- Vérifier qu’aucune référence à `installGlobalChunkRecovery`/`recoverFromStaleBuildOnce` ne subsiste.

6) Publication et validation prod immédiate
- Publier le hotfix.
- Validation post-publish (priorité routes critiques): `/`, `/auth`, `/dashboard`, et la route client impactée `/events/:id`.
- Vérifier que le HTML publié est à nouveau l’app (et non la page fallback “Erreur de chargement”).
- Vérifier console/network: plus d’erreurs de chargement de module/chunk au premier chargement.

7) Filet de sécurité opérationnel
- Si un client reste bloqué, donner URL avec query de bust (`?v=timestamp`) + hard refresh.
- Ajouter un mini runbook incident (2-3 étapes) pour support interne.

Détails techniques (ce qui sera modifié exactement)
- `src/main.tsx`: simplification bootstrap, suppression recovery global.
- `src/lib/runtimeRecovery.ts`: suppression ou neutralisation complète.
- `src/components/RouteErrorBoundary.tsx`: boundary passive, sans auto-recovery.
- `vite.config.ts`: suppression `manualChunks` temporaire.
- `index.html`: suppression manifest/meta PWA non nécessaires.

Critères de succès (bloquants)
- Le publié n’affiche plus la page fallback “Erreur de chargement”.
- Aucune erreur de chunk/module au chargement initial des routes critiques.
- Build TS/Vite vert.
- Expérience client restaurée sans manipulation complexe.

Après rétablissement (stabilisation J+1)
- Réintroduire l’optimisation de bundles progressivement (si nécessaire), avec tests prod-like et sans logique de recovery intrusive.
