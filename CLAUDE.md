# CLAUDE.md

## Project: Super Tools

Application e-learning construite avec React, TypeScript, Vite, Tailwind CSS et Supabase.

## Skills disponibles

- `/sync-and-pr` — Synchronise la branche courante avec main, gère les conflits, et pousse une PR automatiquement.
- `/learn` — Capture un constat ou un bug comme règle acquise dans `IMPROVEMENTS.md`.

## Amélioration continue

- `IMPROVEMENTS.md` contient des **règles acquises** — pas un backlog. Chaque règle est un invariant à vérifier en permanence.
- Quand l'utilisateur pose une question sur la qualité, l'architecture, la duplication ou les patterns du code, **propose systématiquement** d'exécuter `/learn` pour capturer le constat comme règle.
- Avant de coder une nouvelle feature, consulte `IMPROVEMENTS.md` pour vérifier si des règles documentées s'appliquent (ex: utiliser `useAutoSaveForm` pour tout auto-save, utiliser `resolveContentType()` au lieu de `file.type`).
- Chaque règle inclut un critère de **vérification** concret pour savoir si elle est respectée.

## Conventions

- Utiliser TypeScript strict
- Composants React dans `src/components/`
- Pages dans `src/pages/`
- Styles avec Tailwind CSS
- Backend Supabase (migrations dans `supabase/`)
