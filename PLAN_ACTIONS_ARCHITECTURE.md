# Plan d'Actions Architecture — super-tools

**Date :** 22/02/2026 | **Score initial : 5.5/10** | **Score post-P2 : ~7.5/10**

---

## P0 — URGENT (dette critique) — TRAITÉ

- [x] Écrire des tests pour les hooks critiques (`useAuth`, `data/crm`) — 48 tests, 100% pass
- [x] Décomposer les composants >1000 lignes
  - `MicroDevis.tsx` : 44 useState → `useMicroDevisForm` hook (page réduite de 1557 à ~600 lignes)
  - `FormationDetail.tsx` : toolbar booking → `FormationBookingActions` component (~330 lignes extraites)
  - `ParticipantList.tsx` : actions CRUD → `useParticipantActions` hook (prêt à intégrer)
- [x] Kanban générique — Déjà en place (`KanbanLayout` + `useKanbanDnd` dans `components/kanban/`)
- [x] Mettre en place une CI (lint + tests + build) — `.github/workflows/ci.yml`

## P1 — IMPORTANT (dette structurelle) — TRAITÉ

- [x] Créer une couche `domain/` avec les entités métier — `src/domain/entities/` (Training, CRM, Mission, OKR, Event, EmailTemplate)
- [x] Abstraire Supabase derrière des repositories — `src/domain/repositories/` (interfaces) + `src/infrastructure/supabase/` (implémentations)
- [x] Ajouter Sentry (observabilité) — `@sentry/react` dans `main.tsx` + report dans `PageErrorBoundary`
- [x] Remplacer les 44 useState de MicroDevis par un state objet unique (`useMicroDevisForm`)
- [x] Ajouter Prettier + Husky + lint-staged — `.prettierrc` + `.husky/pre-commit` + `lint-staged` dans `package.json`

## P2 — SOUHAITABLE (qualité long terme) — TRAITÉ

- [x] Implémenter CQRS (séparer queries/mutations) — `hooks/queries/` + `hooks/mutations/` (4 domaines : CRM, Missions, OKR, Events)
- [x] Ajouter la virtualisation des listes longues — `@tanstack/react-virtual` + MediaGrid virtualisé (>60 items)
- [x] Documenter les edge functions Supabase — `docs/EDGE_FUNCTIONS.md` (67 fonctions cataloguées)
- [x] Créer un ADR (Architecture Decision Record) — `docs/adr/` (8 ADR : Supabase, React Query, Repository, CQRS, Kanban, Sentry, Tests, Prettier)
- [x] Mettre en place des E2E tests (Playwright) — `playwright.config.ts` + `e2e/` (3 specs : smoke, auth, navigation)

---

## P3 — CONSOLIDATION (robustesse & maturité) — À TRAITER

> **Audit du 23/02/2026** — Constat : les fondations (P0–P2) sont solides, mais la couverture de tests reste faible (823 lignes / 8 fichiers pour ~56K lignes de code), 36 fichiers dépassent 500 lignes, et 42 casts `as unknown as` fragilisent la type-safety. Aucun diagramme de schéma, aucun runbook de déploiement, aucune documentation composants (Storybook).

### P3a — Tests & couverture (priorité haute) — TRAITÉ

- [x] Augmenter la couverture unitaire des hooks critiques — 8 fichiers de test ajoutés : `useCrmQueries`, `useCrmMutations`, `useMissionQueries`, `useMissionMutations`, `useOKRQueries`, `useOKRMutations`, `useEventQueries`, `useEventMutations` (193 tests, 100% pass)
- [x] Ajouter des tests unitaires pour les services — `services/__tests__/crm-ai.test.ts` (7 tests), `services/__tests__/formations.test.ts` (22 tests)
- [x] Ajouter des tests pour les repositories infrastructure — `infrastructure/supabase/__tests__/` : crm (10 tests), email-template (7 tests), settings (8 tests), training (19 tests)
- [x] Étendre les E2E Playwright — `e2e/protected-routes.spec.ts` (redirect auth sur 10 routes protégées, validation formulaire login), `e2e/public-forms.spec.ts` (formulaires publics : signature, questionnaire, évaluation, émargement)
- [x] Mettre en place un seuil de couverture CI — `@vitest/coverage-v8` installé, `npm run test:coverage` configuré, CI utilise `test:coverage`, config coverage dans `vite.config.ts`

### P3b — Décomposition des gros fichiers (priorité haute)

- [ ] Décomposer `DocumentsManager.tsx` (1 723 lignes) — extraire la logique d'upload, la liste de documents, et les actions en sous-composants/hooks
- [ ] Décomposer `ParticipantList.tsx` (1 184 lignes) — finaliser l'intégration de `useParticipantActions` (P0), extraire les dialogues inline
- [ ] Décomposer `OKRDetailDrawer.tsx` (1 087 lignes) — séparer les onglets (détails, check-ins, historique) en composants dédiés
- [ ] Décomposer `ArenaDiscussion.tsx` (1 400 lignes) — extraire le panel de chat, les contrôles IA, le rendu des messages
- [ ] Décomposer `Questionnaire.tsx` (1 337 lignes) — extraire les sections de formulaire, la logique de scoring, la prévisualisation

### P3c — Type-safety & qualité du code (priorité moyenne)

- [ ] Éliminer les 42 casts `as unknown as` — aligner les types domain/ avec le schéma Supabase réel (fichiers principaux : `KnowledgeBaseManager.tsx`, `DocumentsManager.tsx`, `TrainingNameCombobox.tsx`, `useCommercialCoachData.ts`)
- [ ] Générer les types Supabase automatiquement — `supabase gen types typescript` dans le CI pour détecter les dérives type/schéma
- [ ] Activer `noUncheckedIndexedAccess` dans tsconfig — renforcer la sécurité des accès tableau/objet

### P3d — Documentation & outillage (priorité moyenne)

- [ ] Créer un diagramme ER du schéma de données — documenter les 157 migrations en un schéma visuel (Mermaid ou dbdiagram.io)
- [ ] Rédiger un runbook de déploiement production — procédure de déploiement, rollback, variables d'environnement, checklist pré-prod
- [ ] Documenter les politiques RLS Supabase — vérifier et cataloguer les Row Level Security de chaque table
- [ ] Évaluer l'ajout de Storybook — catalogue visuel des 32 composants `ui/` + composants métier clés

### P3e — Performance & observabilité (priorité basse)

- [ ] Établir des baselines de performance — mesurer FCP, LCP, TTI, CLS en production via Sentry Performance ou web-vitals
- [ ] Auditer les bundles — analyser la taille des chunks avec `rollup-plugin-visualizer`, identifier les dépendances surdimensionnées
- [ ] Étendre la virtualisation — appliquer `@tanstack/react-virtual` aux listes de participants (>100 items) et aux listes CRM
