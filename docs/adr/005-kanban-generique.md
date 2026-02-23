# ADR-005 : Abstraction Kanban générique

**Date :** 2025
**Statut :** Accepté

## Contexte

Trois modules utilisent un board Kanban : CRM (opportunités), Missions, et Contenu. Chacun avait sa propre implémentation drag-and-drop avec `@dnd-kit`.

## Décision

Créer une abstraction Kanban réutilisable :

```
src/components/kanban/
├── KanbanLayout.tsx     → Layout de base (colonnes horizontales scrollables)
├── useKanbanDnd.ts      → Hook DnD partagé (@dnd-kit/core + sortable)
```

Chaque module instancie le layout avec ses propres composants de carte et de colonne.

## Conséquences

- **Positif :** Comportement DnD uniforme, moins de code dupliqué, maintenance centralisée
- **Négatif :** Abstraction parfois trop générique pour des besoins spécifiques (CRM a des fonctionnalités de recherche/filtrage que les autres n'ont pas)
