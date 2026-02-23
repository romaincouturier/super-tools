# ADR-007 : Stratégie de tests

**Date :** 2026-02 (P0 + P2)
**Statut :** Accepté

## Contexte

L'application n'avait aucun test. La CI n'existait pas.

## Décision

Stratégie en trois niveaux :

### P0 — Tests unitaires (Vitest)
- Framework : **Vitest** avec `jsdom` et `@testing-library/react`
- Cibles : hooks critiques (`useAuth`, `data/crm`)
- Mocks : Client Supabase mocké (`src/test/mocks/supabase.ts`)
- CI : GitHub Actions (lint + tests + build)

### P2 — Tests E2E (Playwright)
- Framework : **Playwright**
- Cibles : Flux critiques (auth, formations CRUD, CRM kanban)
- Structure : `e2e/` à la racine avec fixtures réutilisables

### Hors scope
- Tests d'intégration Supabase (nécessiteraient un projet de test dédié)
- Tests de performance (à évaluer après virtualisation)

## Conséquences

- **Positif :** Couverture progressive, CI rapide (<2 min), régression détectée avant merge
- **Négatif :** Mocks Supabase à maintenir en sync avec le schéma
