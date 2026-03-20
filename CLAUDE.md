# CLAUDE.md

## Project: Super Tools

Application e-learning construite avec React, TypeScript, Vite, Tailwind CSS et Supabase.

## Skills disponibles

- `/sync-and-pr` — Synchronise la branche courante avec main, gère les conflits, et pousse une PR automatiquement.
- `/learn` — Capture un constat ou une question en item d'amélioration continue dans `IMPROVEMENTS.md`.

## Amélioration continue

- Quand l'utilisateur pose une question sur la qualité, l'architecture, la duplication ou les patterns du code, **propose systématiquement** d'exécuter `/learn` à la fin de ta réponse pour capturer le constat.
- Avant de coder une nouvelle feature, consulte `IMPROVEMENTS.md` pour vérifier si des patterns documentés s'appliquent (ex: utiliser `useAutoSaveForm` pour tout auto-save).
- Les items résolus dans `IMPROVEMENTS.md` servent de documentation vivante des décisions architecturales.

## Conventions

- Utiliser TypeScript strict
- Composants React dans `src/components/`
- Pages dans `src/pages/`
- Styles avec Tailwind CSS
- Backend Supabase (migrations dans `supabase/`)
