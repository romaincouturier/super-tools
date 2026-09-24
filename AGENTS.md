# AGENTS.md

<!-- bmad:context -->
<!-- Verified 2026-09-24 against fea1468. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## super-tools

Système d'information de SuperTilt, organisme de formation : formations et LMS, CRM et devis, missions, contenu, support. React 18 + TypeScript + Vite + Tailwind/shadcn, Supabase (Postgres + RLS, Edge Functions Deno). Vue produit : `PRD.md`. Architecture : `docs/architecture.md`. Livrables BMAD : `_bmad-output/`.

## Politique

- Ne jamais pousser sur `main` : Lovable y pousse sans protection de branche. Travailler sur une branche, livrer par PR.
- Les règles de `IMPROVEMENTS.md` sont des invariants, pas un backlog : les consulter avant de coder une feature. `bash scripts/check-rules.sh` doit passer avant chaque commit ; corriger toute violation, ne jamais l'ignorer.
- Toute règle ajoutée à `IMPROVEMENTS.md` porte un critère de vérification concret et le check correspondant dans `scripts/check-rules.sh`.
- Un changement dans `supabase/config.toml`, `supabase/functions/`, `supabase/migrations/` ou `src/integrations/supabase/` explicite son impact sécurité dans la PR.
- Ne pas déplacer `supabase/migrations-apres-front/*` vers `supabase/migrations/` avant la publication du front : ces migrations cassent l'app en ligne. Procédure : `supabase/migrations-apres-front/README.md`.
- Ne pas éditer `_bmad/config.toml` ni `_bmad/config.user.toml` (régénérés par l'installeur BMAD) ; surcharges dans `_bmad/custom/`.

## Où sont les choses

- Routeur : `src/App.tsx`.
- Helpers partagés des Edge Functions : `supabase/functions/_shared/` (OAuth Google, MIME, Pennylane, suivi de coût API). Chercher là avant d'écrire un helper.
- Tests d'isolation RLS (pgTAP) : `supabase/tests/*.test.sql`, joués par le workflow `RLS tests` sur toute PR touchant `supabase/migrations/`.
- BMAD : point d'entrée `/bmad-help`. Orchestrateur `bmad-loop` : `.bmad-loop/policy.toml`, exige `_bmad-output/implementation-artifacts/sprint-status.yaml` (produit par `/bmad-sprint-planning`).

## Lancer et vérifier

- Typecheck : `npm run typecheck`, jamais `npx tsc --noEmit` : `tsconfig.json` est un fichier solution et cette commande compile zéro fichier.
- Avant de pousser, lancer ce que la CI lance : `npm run typecheck`, `bash scripts/check-rules.sh`, `npm test`.
- `npm test` couvre aussi `supabase/functions/_shared/**/*.test.ts` et `supabase/tests/**/*.test.ts`, pas seulement `src/`.
- npm uniquement (CI : `npm ci`, Node 20).

## Conventions qui diffèrent des défauts

- Flux de données : page -> hook (`src/hooks/`) -> service (`src/services/`) -> Supabase. Pas de `supabase.from()` ni de `fetch()` direct dans un composant UI.
- Documentation, messages de commit et textes UI en français.

## Pièges connus

- Pousser sur GitHub n'applique aucune migration à la base hébergée : seules celles créées par Lovable le sont. Une migration de `supabase/migrations/` doit être jouée explicitement.

<!-- /bmad:context -->
