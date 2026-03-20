# Backlog d'amélioration continue

Ce fichier est géré automatiquement par la skill `/learn`.
Chaque item est issu d'une question ou d'un constat fait pendant une session de développement.

---

## Duplication

_(aucun item pour le moment)_

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

_(aucun item pour le moment)_

## Performance

_(aucun item pour le moment)_

## Sécurité

_(aucun item pour le moment)_

## DX

_(aucun item pour le moment)_
