---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context']
lastStep: 'step-02-load-context'
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
