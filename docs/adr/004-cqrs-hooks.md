# ADR-004 : CQRS au niveau des hooks React

**Date :** 2026-02 (P2)
**Statut :** Accepté

## Contexte

Les hooks métier (useCrmBoard, useMissions, useOKR, useEvents) mélangeaient queries et mutations dans un seul fichier. `useCrmBoard.ts` exportait 42 hooks. Cela nuisait à la lisibilité et la maintenabilité.

## Décision

Séparer les hooks en deux répertoires :

```
src/hooks/queries/     → useQuery hooks (lectures)
src/hooks/mutations/   → useMutation hooks (écritures)
src/hooks/             → Barrel re-exports (rétrocompatibilité)
```

Les query keys sont définis et exportés depuis les fichiers queries, puis importés dans les mutations pour l'invalidation.

## Conséquences

- **Positif :** Chaque fichier a une responsabilité unique, navigation plus claire, imports ciblés possibles
- **Négatif :** Plus de fichiers à naviguer
- **Rétrocompatibilité :** Les fichiers originaux (`useCrmBoard.ts`, etc.) sont des barrel re-exports — aucun import existant ne casse
