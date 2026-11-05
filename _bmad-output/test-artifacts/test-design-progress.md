---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-11-05'
---

# Test design : module Contenus sociaux

## Étape 1 : mode

Mode **epic** : il existe des epics et des stories avec leurs critères d'acceptation (`_bmad-output/planning-artifacts/epics-contenus-sociaux.md`), mais ni PRD ni décisions d'architecture propres au module. Périmètre choisi par Romain : les **5 epics**, avec un plan de test par epic.

## Étape 2 : contexte

- **Exigences** : `epics-contenus-sociaux.md` (FR1 à FR32, NFR1 à NFR8, UX-DR1 à UX-DR9, 23 stories), spec `_bmad-output/specs/spec-contenus-sociaux/` (`SPEC.md`, `statuts-et-validation.md`, `maquette-calendrier.md`, `brownfield.md`).
- **Architecture** : `_bmad-output/planning-artifacts/architecture/architecture-super-tools-2026-09-24/ARCHITECTURE-SPINE.md` (AD-1 RLS, AD-5 hooks, AD-8 migrations, AD-9 sauvegarde et mode démo, AD-11 propriétaire unique).
- **Pile détectée** : fullstack. React + Vite côté front, Supabase (Postgres + RLS, edge functions Deno) côté serveur.

### Outillage de test existant

| Niveau | Outil | Emplacement | Exécution |
| --- | --- | --- | --- |
| Unitaire (front, `_shared`) | Vitest (`npm test`, `TZ=UTC`) | `src/**/*.test.ts(x)`, `supabase/functions/_shared/**/*.test.ts` | CI à chaque PR |
| SQL réel (fonctions, RLS) | Vitest + PGlite : les fonctions sont extraites de la migration qui les livre (`loadFunctions`), `actAs()` règle l'identité | `supabase/tests/*.test.ts`, `supabase/tests/helpers/db.ts` | CI (`npm test`) |
| RLS de bout en bout | pgTAP sur base locale qui rejoue toutes les migrations | `supabase/tests/*.test.sql`, workflow `rls-tests.yml` | CI sur toute PR qui touche `supabase/migrations/` |
| E2E navigateur | Playwright | `e2e/smoke.spec.ts` : pages publiques seulement, aucun parcours authentifié | CI (smoke) |
| Mode démo | Playwright contre un faux Supabase avec des données canari | `e2e/demo-scan/`, `npm run scan:demo` | Workflow `demo-scan.yml` |
| Règles du dépôt | `scripts/check-rules.sh` | | CI et avant chaque commit |

**Manques constatés** :
- aucun parcours E2E authentifié (le smoke le note : « à ajouter par module ») ;
- aucun test du serveur MCP (`supabase/functions/mcp-server/index.ts` démarre un serveur à l'import) ;
- les actions quotidiennes (`generate-daily-actions`) ne sont pas testées dans leur ensemble, seuls des fetchers `_shared` le sont.

### Connaissances chargées

`risk-governance`, `probability-impact`, `test-levels-framework` et `test-priorities-matrix`, depuis `.claude/skills/bmad-testarch-test-design/resources/knowledge/`. Pas de contrats Pact : le module n'a pas de microservices. Pas d'exploration navigateur : le module n'existe pas encore.

## Étapes 3 à 5 : plans produits

| Epic | Plan | Risques (≥6) | Scénarios P0 / P1 / P2 / P3 | Effort |
| --- | --- | --- | --- | --- |
| 1 Planifier et rédiger | `test-design/test-design-epic-1-contenus-sociaux.md` | 18 (5) | 7 / 28 / 17 / 5 | ~55 à 90 h |
| 2 Valider | `test-design/test-design-epic-2-contenus-sociaux.md` | 20 (6, dont un à 9) | 14 / 39 / 13 / 3 | ~56 à 94 h |
| 3 Campagnes et vues | `test-design/test-design-epic-3-contenus-sociaux.md` | 18 (6) | 8 / 33 / 20 / 3 | ~50 à 81 h |
| 4 MCP | `test-design/test-design-epic-4-contenus-sociaux.md` | 19 (5) | 6 / 33 / 14 / 2 | ~44 à 75 h |
| 5 Sortie du kanban | `test-design/test-design-epic-5-contenus-sociaux.md` | 17 (6) | 6 / 27 / 6 / 2 | ~45 à 75 h |
| **Total** | | **92 (28)** | **41 / 160 / 70 / 15 (286)** | **~250 à 415 h** |

Le harnais E2E authentifié, qui n'existe pas encore, est chiffré à part (~1 à 3 jours).

## Décisions transverses relevées par les plans

1. **Garde en base sur le statut de validation** (epic 2, R-001, score 9 ; epic 4, R-001). La clé service role du MCP ignore la RLS, et la RLS autorise l'UPDATE de toute la ligne. Seule barrière fiable : un trigger qui refuse toute écriture du statut hors de la fonction de transition.
2. **Identité de l'acteur** (epic 2, R-004 ; epic 4, R-002). En service role, `auth.uid()` vaut NULL. Proposition : un paramètre acteur accepté seulement en service role, et ignoré pour un appel du navigateur.
3. **Logique de groupe en base** (epic 1). La propagation du texte et la datation d'un groupe se font en fonction SQL ou en trigger. On peut ainsi les tester sur PGlite et le MCP les reprend.
4. **Fuseau horaire** (epics 1, 3 et 4). Les dates s'interprètent en Europe/Paris, alors que la suite tourne en `TZ=UTC`. Les tests couvrent les changements d'heure.
5. **Comptes de test** (epics 1 et 3). `has_module_access` renvoie vrai pour `romain@supertilt.fr` sans aucun droit : un test positif fait avec ce compte ne prouve rien. Les vues personnelles reposent sur le propriétaire (`auth.uid()`).
6. **Annuaire côté serveur** (epic 2, Q7). `get_staff_directory` refuse un appel sans session : `generate-daily-actions` ne peut donc pas l'utiliser. Le critère de la story 2.1 est à reformuler pour le côté serveur.
7. **Fonctions pures partagées** (epics 1 et 4). La règle d'alerte et le calcul du statut affiché vivent dans `supabase/functions/_shared/`, avec une copie contrôlée côté front (règle [057]).
