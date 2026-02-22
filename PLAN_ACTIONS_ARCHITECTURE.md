# Plan d'Actions Architecture — super-tools

**Date :** 22/02/2026 | **Score initial : 5.5/10**

---

## P0 — URGENT (dette critique) — TRAITÉ

- [x] Écrire des tests pour les hooks critiques (`useAuth`, `data/crm`) — 48 tests, 100% pass
- [x] Décomposer les composants >1000 lignes
  - `MicroDevis.tsx` : 44 useState → `useMicroDevisForm` hook (page réduite de 1557 à ~600 lignes)
  - `FormationDetail.tsx` : toolbar booking → `FormationBookingActions` component (~330 lignes extraites)
  - `ParticipantList.tsx` : actions CRUD → `useParticipantActions` hook (prêt à intégrer)
- [x] Kanban générique — Déjà en place (`KanbanLayout` + `useKanbanDnd` dans `components/kanban/`)
- [x] Mettre en place une CI (lint + tests + build) — `.github/workflows/ci.yml`

## P1 — IMPORTANT (dette structurelle)

- [ ] Créer une couche `domain/` avec les entités métier
- [ ] Abstraire Supabase derrière des repositories
- [ ] Ajouter Sentry ou équivalent (observabilité)
- [x] Remplacer les 44 useState de MicroDevis par un state objet unique (`useMicroDevisForm`)
- [ ] Ajouter Prettier + Husky + lint-staged

## P2 — SOUHAITABLE (qualité long terme)

- [ ] Implémenter CQRS (séparer queries/mutations)
- [ ] Ajouter la virtualisation des listes longues
- [ ] Documenter les edge functions Supabase
- [ ] Créer un ADR (Architecture Decision Record)
- [ ] Mettre en place des E2E tests (Playwright)
