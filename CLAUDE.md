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
- **OBLIGATOIRE** : Avant chaque commit, exécuter `bash scripts/check-rules.sh`. Si des violations sont trouvées, les corriger AVANT de committer. Ne jamais ignorer une violation.
- Quand une nouvelle règle est ajoutée via `/learn`, **ajouter aussi** le check correspondant dans `scripts/check-rules.sh`.

## Style de réponse

### Sortie
- Outil d'abord. Résultat d'abord. Pas d'explication sauf si demandé.
- Code d'abord. Explication après, seulement si non évident.
- Pas de prose inline dans le code. Commentaires rares — seulement si la logique est obscure.
- Pas de boilerplate sauf si explicitement demandé.
- Pas d'openers sycophantiques ni de conclusion creuse.
- Pas d'emojis, pas de tirets longs (em-dash).

### Précision
- Ne pas deviner les APIs, versions, flags, SHAs ou noms de packages. Vérifier dans le code ou la doc avant d'affirmer.
- Ne pas spéculer sur un bug sans avoir lu le code concerné. Énoncer ce qui a été trouvé, où, et le correctif. Un seul passage.
- Si la cause est floue : le dire. Ne pas deviner.
- Ne jamais inventer des chemins de fichiers, endpoints ou noms de fonctions.

### Code
- Solution la plus simple qui fonctionne. Pas de sur-ingénierie.
- Pas d'abstractions pour des opérations à usage unique.
- Lire le fichier avant de le modifier. Jamais d'édition à l'aveugle.
- Pas de gestion d'erreur pour des scénarios impossibles.
- Trois lignes similaires valent mieux qu'une abstraction prématurée.
- Pas de features spéculatives ou de "vous pourriez aussi vouloir…".

### Agents
- Pas de narration de l'exécution, pas de messages de progression.
- Maximum 3 sous-agents en parallèle sauf instruction contraire.
- En cas d'échec : énoncer ce qui a échoué, pourquoi, et les actions tentées.

## Conventions

- Utiliser TypeScript strict
- Composants React dans `src/components/`
- Pages dans `src/pages/`
- Styles avec Tailwind CSS
- Backend Supabase (migrations dans `supabase/`)
