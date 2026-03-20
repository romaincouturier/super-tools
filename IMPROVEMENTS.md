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

_(aucune règle pour le moment)_

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

### [004] Toujours utiliser resolveContentType() — jamais file.type directement
- **Constat** : `file.type` peut être vide sur certains navigateurs (notamment Safari pour les SVG). La fonction `resolveContentType()` gère ce cas avec un fallback par extension.
- **Règle** : Ne jamais utiliser `file.type` directement. Toujours passer par `resolveContentType(file)`.
- **Vérification** : `grep -r "file\.type" src/` — tout résultat hors de `file-utils.ts` est suspect.
- **Fichiers de référence** : `src/lib/file-utils.ts` (resolveContentType)
- **Origine** : bug SVG — `file.type` vide sur certains navigateurs
- **Date** : 2026-03-20

## Sécurité

_(aucune règle pour le moment)_

## DX

_(aucune règle pour le moment)_
