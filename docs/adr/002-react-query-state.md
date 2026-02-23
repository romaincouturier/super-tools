# ADR-002 : React Query pour le state management serveur

**Date :** 2024
**Statut :** Accepté

## Contexte

L'application effectue de nombreuses requêtes Supabase. Le state management classique (Redux, Zustand) nécessiterait du boilerplate pour le cache, l'invalidation, le loading state et les mutations.

## Décision

Utiliser `@tanstack/react-query` comme solution de state management serveur :
- **Queries** (`useQuery`) pour toutes les lectures de données
- **Mutations** (`useMutation`) pour toutes les écritures
- **Invalidation** automatique après mutation via `queryClient.invalidateQueries()`
- **Pas de store global** — chaque donnée est cachée via sa query key

## Conséquences

- **Positif :** Cache automatique, loading/error states intégrés, re-fetch on focus, mutations optimistes possibles
- **Négatif :** Pas de state partagé entre composants sans query (résolu par React context pour l'auth)
- **Évolution (P2) :** Séparation CQRS — queries dans `hooks/queries/`, mutations dans `hooks/mutations/`
