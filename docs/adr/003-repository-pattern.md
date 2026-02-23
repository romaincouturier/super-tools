# ADR-003 : Repository pattern pour l'abstraction de la couche données

**Date :** 2026-02 (P1)
**Statut :** Accepté

## Contexte

Les hooks accédaient directement à Supabase, créant un couplage fort entre la logique métier et l'infrastructure. Cela rendait les tests difficiles et la migration vers un autre backend impossible.

## Décision

Implémenter le pattern Repository avec trois couches :

```
src/domain/entities/        → Types métier (Training, CrmCard, Mission, ...)
src/domain/repositories/    → Interfaces (ITrainingRepository, ICrmRepository, ...)
src/infrastructure/supabase/ → Implémentations Supabase
src/data/                    → Façade rétrocompatible (délègue aux repositories)
```

## Conséquences

- **Positif :** Testabilité (mock des repositories), séparation des préoccupations, possibilité de changer d'infrastructure
- **Négatif :** Code supplémentaire (interfaces + implémentations), indirection
- **Rétrocompatibilité :** `src/data/` conservé comme façade pour ne pas casser les imports existants
