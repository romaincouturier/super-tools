# Backlog d'amélioration continue

Ce fichier est géré automatiquement par la skill `/learn`.
Chaque item est issu d'une question ou d'un constat fait pendant une session de développement.

---

## Duplication

### [DUP-003] Extraire getFileType() dans file-utils.ts
- **Constat** : La fonction `getFileType(file: File)` est dupliquée à l'identique dans `EntityMediaManager.tsx` et `MediaUploadDialog.tsx`. Le même bug (utilisation de `file.type` au lieu de `resolveContentType()`) a dû être corrigé dans les deux fichiers.
- **Fichiers concernés** : `src/components/media/EntityMediaManager.tsx:34-38`, `src/components/media/MediaUploadDialog.tsx:45-49`, `src/lib/file-utils.ts`
- **Action suggérée** : Extraire `getFileType()` dans `src/lib/file-utils.ts` et l'importer dans les deux composants. Elle y rejoint logiquement `resolveContentType()` qu'elle utilise déjà.
- **Priorité** : haute
- **Origine** : bug SVG non uploadable — même correction appliquée deux fois
- **Date** : 2026-03-20

## Architecture

_(aucun item pour le moment)_

## Pattern

### [PATTERN-001] Auto-save : useAutoSaveForm est le pattern standard
- **Constat** : Le hook `useAutoSaveForm` existait déjà mais `MissionDetailDrawer` réimplémentait le même pattern manuellement (skipNextSaveRef, saveTimeoutRef, pendingUpdatesRef). `EventEdit` n'avait pas d'auto-save du tout.
- **Fichiers concernés** : `src/hooks/useAutoSaveForm.ts`, `src/components/missions/MissionDetailDrawer.tsx`, `src/pages/EventEdit.tsx`
- **Action suggérée** : Déjà corrigé — MissionDetailDrawer et EventEdit utilisent maintenant `useAutoSaveForm`. Vérifier que tout nouveau formulaire avec auto-save utilise ce hook.
- **Priorité** : moyenne
- **Origine** : question "est-ce que l'auto-save peut être refactorisé pour éviter du code dupliqué ?"
- **Date** : 2026-03-20
- **Statut** : ✅ résolu

### [PATTERN-002] Gestion de fichiers : architecture bien mutualisée
- **Constat** : L'upload/gestion de fichiers est correctement mutualisé via `EntityDocumentsManager` (documents), `EntityMediaManager` (médias), `useEntityDocuments` et `useMedia` (hooks), et `file-utils.ts` (utilitaires). Les seuls cas spécialisés (participants, CRM, support) le sont pour des raisons métier valides.
- **Fichiers concernés** : `src/components/shared/EntityDocumentsManager.tsx`, `src/components/media/EntityMediaManager.tsx`, `src/hooks/useEntityDocuments.ts`, `src/hooks/useMedia.ts`, `src/lib/file-utils.ts`
- **Action suggérée** : Aucune action requise. Pattern à suivre pour toute nouvelle entité nécessitant des fichiers.
- **Priorité** : basse
- **Origine** : question "est-ce que l'ajout de fichier est un code mutualisé ?"
- **Date** : 2026-03-20
- **Statut** : ✅ documenté

## Dette

_(aucun item pour le moment)_

## Convention

### [CONV-004] Toujours utiliser resolveContentType() pour détecter le type MIME
- **Constat** : `file.type` peut être vide sur certains navigateurs (notamment Safari pour les SVG). La fonction `resolveContentType()` dans `file-utils.ts` gère ce cas avec un fallback par extension, mais elle n'était pas utilisée partout — `getFileType()` accédait directement à `file.type`.
- **Fichiers concernés** : `src/lib/file-utils.ts` (resolveContentType), tout composant manipulant des fichiers uploadés
- **Action suggérée** : Convention à respecter : ne jamais utiliser `file.type` directement, toujours passer par `resolveContentType(file)`. Ajouter un commentaire dans `file-utils.ts` pour documenter cette règle.
- **Priorité** : haute
- **Origine** : bug SVG — `file.type` vide sur certains navigateurs
- **Date** : 2026-03-20

## Performance

_(aucun item pour le moment)_

## Sécurité

_(aucun item pour le moment)_

## DX

_(aucun item pour le moment)_
