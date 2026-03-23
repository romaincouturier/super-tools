# Règles d'amélioration continue

Ce fichier est géré automatiquement par la skill `/learn`.
Chaque règle est issue d'un constat fait pendant le développement — un bug, une question, un pattern identifié.
Ce ne sont pas des tickets : ce sont des **invariants** à vérifier en permanence.

---

## Duplication

### [003] Extraire getFileType() dans file-utils.ts — ne jamais dupliquer une fonction utilitaire
- **Constat** : La fonction `getFileType(file: File)` était dupliquée à l'identique dans `EntityMediaManager.tsx` et `MediaUploadDialog.tsx`. Le même bug (`file.type` au lieu de `resolveContentType()`) a dû être corrigé dans les deux fichiers.
- **Règle** : Toute fonction utilitaire doit exister en un seul exemplaire dans `src/lib/`. Si elle est copiée-collée, l'extraire immédiatement.
- **Vérification** : Chercher les fonctions définies dans plusieurs composants avec le même nom ou le même corps.
- **Fichiers de référence** : `src/lib/file-utils.ts`
- **Origine** : bug SVG non uploadable — même correction appliquée deux fois
- **Date** : 2026-03-20

## Architecture

### [010] Éditeur Tiptap missions — supprimer une image doit aussi nettoyer le storage
- **Constat** : Les images insérées dans l'éditeur Tiptap des pages mission (upload, drag-drop, coller) sont enregistrées dans le media library via `registerMediaEntry()`, mais il n'existe aucun mécanisme de suppression. Pas de bubble menu, pas de menu contextuel. Si l'utilisateur supprime une image au clavier (Backspace/Suppr), le nœud est retiré du HTML mais le fichier reste orphelin dans le bucket `mission-media` et l'entrée persiste en base. Seul l'onglet Galerie (`EntityMediaManager`) offre une suppression complète (storage + BDD).
- **Règle** : Toute insertion d'image dans un éditeur riche doit avoir un mécanisme de suppression symétrique qui nettoie le fichier storage ET l'entrée en base. L'éditeur Tiptap des missions doit proposer un bubble menu sur les images avec au minimum un bouton supprimer. La suppression doit appeler `deleteMediaFile()` + `useDeleteMedia()` comme le fait `EntityMediaManager`.
- **Vérification** : Vérifier que `MissionPages.tsx` inclut un `BubbleMenu` ou un `NodeViewWrapper` pour les images avec une action de suppression. Chercher les appels `registerMediaEntry` sans `deleteMediaFile` correspondant dans le même fichier.
- **Fichiers de référence** : `src/components/missions/MissionPages.tsx` (upload sans delete), `src/components/media/EntityMediaManager.tsx` (bon pattern avec delete complet), `src/hooks/useMedia.ts` (`deleteMediaFile`, `useDeleteMedia`)
- **Origine** : question "est-ce qu'on peut supprimer une image dans une mission ?"
- **Date** : 2026-03-23

### [006] React Query — désactiver refetchOnWindowFocus pour ne jamais perdre l'état des formulaires
- **Constat** : Sur quasiment tous les formulaires avec des dropdowns, changer d'onglet/application et revenir faisait disparaître les choix sélectionnés. React Query a `refetchOnWindowFocus: true` par défaut : chaque retour d'onglet déclenchait un refetch de toutes les queries, les options des selects se rechargaient, et la valeur sélectionnée était perdue (Radix UI valide la sélection contre la liste d'options). Bug récurrent depuis 1 mois malgré des corrections ponctuelles qui ne ciblaient jamais la config globale.
- **Règle** : `refetchOnWindowFocus: false` doit être défini globalement dans le QueryClient. Ne jamais ajouter `refetchOnWindowFocus: true` sur des queries qui alimentent des formulaires. Les `useEffect` qui initialisent un formulaire depuis des données query doivent être gardés par un ID (ex: `entity.id !== prevIdRef.current`) pour ne pas écraser les modifications en cours lors d'un refetch.
- **Vérification** : `grep -r "refetchOnWindowFocus: true" src/` — tout résultat est suspect. Vérifier que le QueryClient dans `App.tsx` a bien `refetchOnWindowFocus: false`. Chercher `useEffect` + `setValues`/`setValue`/`setFormData` dépendant de données query sans garde par ID.
- **Fichiers de référence** : `src/App.tsx` (config QueryClient), `src/components/crm/CardDetailDrawer.tsx` (bon pattern avec `prevCardIdRef`), `src/pages/EventEdit.tsx` (corrigé avec `prevEventIdRef`)
- **Origine** : bug récurrent — les sélections dropdown disparaissent au changement d'onglet sur tous les formulaires
- **Date** : 2026-03-20

## Pattern

### [002] Gestion de fichiers — architecture mutualisée via EntityDocumentsManager / EntityMediaManager
- **Constat** : L'upload/gestion de fichiers est correctement mutualisé. Les seuls cas spécialisés (participants, CRM, support) le sont pour des raisons métier valides.
- **Règle** : Toute nouvelle entité nécessitant des fichiers doit utiliser `EntityDocumentsManager` (documents) ou `EntityMediaManager` (médias), avec les hooks `useEntityDocuments` / `useMedia`.
- **Vérification** : Vérifier qu'aucun nouveau composant ne réimplémente l'upload from scratch.
- **Fichiers de référence** : `src/components/shared/EntityDocumentsManager.tsx`, `src/components/media/EntityMediaManager.tsx`, `src/hooks/useEntityDocuments.ts`, `src/hooks/useMedia.ts`, `src/lib/file-utils.ts`
- **Origine** : question "est-ce que l'ajout de fichier est un code mutualisé ?"
- **Date** : 2026-03-20

### [001] Auto-save — toujours utiliser useAutoSaveForm
- **Constat** : `MissionDetailDrawer` réimplémentait le pattern auto-save manuellement (skipNextSaveRef, saveTimeoutRef, pendingUpdatesRef) alors que le hook `useAutoSaveForm` existait déjà. Corrigé.
- **Règle** : Tout formulaire avec auto-save doit utiliser le hook `useAutoSaveForm`. Ne jamais réimplémenter le pattern manuellement.
- **Vérification** : Chercher `setTimeout` + `save` ou `saveTimeoutRef` dans les composants formulaire — si trouvé, c'est une violation.
- **Fichiers de référence** : `src/hooks/useAutoSaveForm.ts`
- **Origine** : question "est-ce que l'auto-save peut être refactorisé ?"
- **Date** : 2026-03-20

## Convention

### [005] Overlays hover sur images — toujours promouvoir en couche GPU
- **Constat** : Les vignettes de la galerie (`MediaGrid`, `EntityMediaManager`) ramaient au hover. Les overlays `transition-opacity` sur des images pleine résolution déclenchaient un repaint complet à chaque frame. Le `backdrop-blur-sm` sur les badges aggravait le problème.
- **Règle** : Tout overlay avec `transition-opacity` sur une image doit avoir `will-change-[opacity]`. Les images sous l'overlay doivent avoir `will-change-transform`. Ne jamais utiliser `backdrop-blur` sur des éléments qui se superposent à des images dans une grille.
- **Vérification** : Chercher `transition-opacity` dans les composants media/galerie — vérifier que `will-change` est présent. Chercher `backdrop-blur` sur des badges superposés à des images.
- **Fichiers de référence** : `src/components/media/MediaGrid.tsx`, `src/components/media/EntityMediaManager.tsx`
- **Origine** : lag au hover sur les vignettes de la galerie
- **Date** : 2026-03-20

### [004] Toujours utiliser resolveContentType() — jamais file.type directement
- **Constat** : `file.type` peut être vide sur certains navigateurs (notamment Safari pour les SVG). La fonction `resolveContentType()` gère ce cas avec un fallback par extension.
- **Règle** : Ne jamais utiliser `file.type` directement. Toujours passer par `resolveContentType(file)`.
- **Vérification** : `grep -r "file\.type" src/` — tout résultat hors de `file-utils.ts` est suspect.
- **Fichiers de référence** : `src/lib/file-utils.ts` (resolveContentType)
- **Origine** : bug SVG — `file.type` vide sur certains navigateurs
- **Date** : 2026-03-20

## Responsive

### [007] Modales et dialogues — toujours `w-full sm:max-w-{size}` pour le mobile
- **Constat** : 11 modales (CRM, formations, onboarding) avaient des largeurs fixes (`max-w-2xl`, `max-w-lg`, etc.) sans `w-full` mobile. Sur un écran < 480px, la partie gauche était tronquée et le contenu inaccessible. Même problème sur les `SheetContent` (ex: Support `w-[480px]` sans `w-full`).
- **Règle** : Tout `DialogContent`, `AlertDialogContent` ou `SheetContent` doit utiliser `w-full sm:max-w-{size}`. Toute grille de formulaire (`grid-cols-2`, `grid-cols-3`) doit avoir un fallback mobile `grid-cols-1 sm:grid-cols-N`.
- **Vérification** : Chercher `DialogContent.*max-w-` et `SheetContent.*w-\[` sans `w-full` précédent. Chercher `grid-cols-[2-9]` sans `grid-cols-1 sm:` dans les composants formulaire.
- **Fichiers de référence** : tous les `DialogContent` dans `src/components/`
- **Origine** : modale ticket support tronquée sur mobile — audit de 11 modales
- **Date** : 2026-03-21

## Sécurité

### [008] CORS — ne jamais utiliser `Access-Control-Allow-Origin: *` en production
- **Constat** : Toutes les edge functions Supabase (50+) utilisent un header CORS wildcard `"Access-Control-Allow-Origin": "*"` via `_shared/cors.ts`. Cela expose les API à des appels depuis n'importe quel site externe (risque CSRF, abus de quotas API).
- **Règle** : Les headers CORS doivent restreindre l'origine aux domaines légitimes. Utiliser la configuration centralisée dans `_shared/cors.ts` avec le domaine de production.
- **Vérification** : `grep -r '"Access-Control-Allow-Origin": "\*"' supabase/functions/` — aucun résultat ne devrait apparaître.
- **Fichiers de référence** : `supabase/functions/_shared/cors.ts`
- **Origine** : audit de sécurité approfondi
- **Date** : 2026-03-21

### [009] RLS — les policies publiques (anon) doivent toujours valider un token
- **Constat** : Plusieurs policies RLS pour les formulaires publics (questionnaire, émargement, évaluation) utilisent `USING (true)` au lieu de valider le token d'accès. Tout utilisateur anonyme peut lire/modifier les données de tous les participants.
- **Règle** : Toute policy RLS pour le rôle `anon` doit inclure une validation de token dans la clause `USING`. Ne jamais utiliser `USING (true)` pour des données sensibles accessibles publiquement.
- **Vérification** : `grep -rn "TO anon" supabase/migrations/ | grep -i "USING (true)"` — tout résultat est une violation.
- **Fichiers de référence** : `supabase/migrations/20260130*.sql`, `supabase/migrations/20260202180500*.sql`
- **Origine** : audit de sécurité approfondi
- **Date** : 2026-03-21

## DX

### [012] Lovable scaffolding — auditer et supprimer le code mort après chaque génération
- **Constat** : Lovable génère systématiquement du code scaffolding jamais utilisé : 13 composants UI Radix (hover-card, sidebar, menubar…), des wrappers à 1 import (ReviewSection.tsx), du CSS legacy (App.css), et des imports inutilisés (useTranslation dans Landing.tsx). Au total 1947 lignes mortes accumulées en quelques semaines de génération.
- **Règle** : Après chaque session Lovable, vérifier les fichiers générés/modifiés. Supprimer tout composant UI avec 0 imports, tout wrapper qui ne fait que passer des props à un enfant unique, tout fichier CSS non importé, et tout import non utilisé. Ne jamais laisser du code mort "au cas où".
- **Vérification** : `for f in src/components/ui/*.tsx; do name=$(basename "$f" .tsx); count=$(grep -r "from.*ui/$name" src/ --include='*.tsx' --include='*.ts' -l | grep -v "ui/$name.tsx" | wc -l); [ "$count" -eq 0 ] && echo "DEAD: $name"; done` — aucun résultat ne devrait apparaître.
- **Fichiers de référence** : `src/components/ui/` (composants gardés = composants importés)
- **Origine** : audit de simplification — 15 fichiers morts supprimés (1947 lignes)
- **Date** : 2026-03-23

### [011] PWA — ne jamais précacher les JS chunks, utiliser NetworkFirst pour les scripts
- **Constat** : `globPatterns: ["**/*.{js,css,html,ico,svg}"]` dans la config Vite PWA précachait tous les JS chunks (279 fichiers, 5.3 Mo). Après chaque deploy, le Service Worker servait des chunks avec des hashes périmés → erreur "Failed to fetch dynamically imported module" → écran blanc. Lovable a empilé 6 commits de "runtime recovery" (clear SW, cache buster, session flags) sans jamais traiter la cause racine.
- **Règle** : Les JS chunks ne doivent JAMAIS être dans `globPatterns` du Service Worker. Utiliser `globPatterns: ["**/*.{css,html,ico,svg}"]` et une stratégie `NetworkFirst` pour les scripts dans `runtimeCaching`. Ne jamais ajouter de logique de "runtime recovery" pour contourner un problème de cache SW — corriger la config à la source.
- **Vérification** : `grep 'globPatterns' vite.config.ts` ne doit PAS contenir `js`. `grep -A2 'destination.*script' vite.config.ts` doit montrer `NetworkFirst`.
- **Fichiers de référence** : `vite.config.ts` (config workbox corrigée)
- **Origine** : production cassée — écran blanc après chaque deploy, Lovable en boucle sur 6 commits de recovery
- **Date** : 2026-03-23
