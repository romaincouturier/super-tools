---
name: process-ticket
description: "Analyse un ticket du kanban support de supertools, code le ticket si c'est faisable, pousse une branche et met à jour le ticket en vibe_coding avec le lien de la branche. Si le besoin est ambigu, écrit les questions dans le ticket et le laisse en qualification avec un point rouge (discussion_requested_at). Usage : /process-ticket ST-2026-XXXX"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion, Agent
---

Argument reçu : $ARGUMENTS

## 0. Lire les variables d'environnement Supabase

Les variables nécessaires sont dans `.env.local` à la racine du projet.
Exécute :
```bash
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
# Fallback sur les variables d'environnement shell
SUPABASE_URL=${SUPABASE_URL:-$VITE_SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}
```

Si `SUPABASE_KEY` est vide, utilise `VITE_SUPABASE_PUBLISHABLE_KEY` à la place (lecture seule possible, écriture refusée par RLS — prévenir l'utilisateur si la mise à jour échoue).

## 1. Récupérer le ticket

Extraire le numéro de ticket de l'argument (format `ST-YYYY-NNNN`).

Requête REST Supabase :
```bash
curl -sS \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.ST_NUMBER&select=*" \
  | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify(d[0],null,2))"
```
(Remplace `ST_NUMBER` par l'argument.)

Si le ticket n'est pas trouvé : afficher une erreur et arrêter.

## 2. Analyser le ticket

Lis les champs du ticket :
- `title`, `description`, `type` (bug | evolution), `priority`
- `ai_analysis` (analyse IA structurée si disponible)
- `page_url` (page concernée)
- `status` actuel

Ensuite, analyse le ticket au regard de la codebase. Pour une évolution :
1. Identifie les fichiers concernés (pages, composants, hooks, services, types, migrations)
2. Vérifie la faisabilité : est-ce cohérent avec l'architecture existante ?
3. Estime la complexité : simple (< 2h), moyenne (2–4h), complexe (> 4h)

Pour un bug :
1. Localise le code responsable en suivant le chemin indiqué dans `page_url` ou `ai_analysis.reproduction`
2. Reproduis mentalement le bug en lisant le code
3. Identifie la cause racine

## 3. Décision : implémenter ou demander

### Si le besoin est clair et faisable :

Passe à l'étape 4 (implémentation).

Critères pour "clair et faisable" :
- La description est précise et non ambiguë
- L'impact est circonscrit (< 10 fichiers)
- Pas de changement de modèle de données complexe ou de logique métier inconnue
- L'analyse IA (`ai_analysis`) est cohérente avec la description

### Si des doutes ou questions existent :

Formule les questions de manière concise et précise. Chaque question doit être actionnable.

Met à jour le ticket via REST :
```bash
curl -sS -X PATCH \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.ST_NUMBER" \
  -d '{
    "resolution_notes": "Questions Claude :\n\n1. ...\n2. ...",
    "discussion_requested_at": "NOW_ISO",
    "updated_at": "NOW_ISO"
  }'
```
(Remplace `NOW_ISO` par la date ISO courante : `$(date -u +"%Y-%m-%dT%H:%M:%SZ")`)

Affiche les questions à l'utilisateur et arrête.

## 4. Implémentation

### 4a. Créer la branche
Génère un slug depuis le titre du ticket (lowercase, tirets) :
```bash
SLUG=$(echo "TICKET_TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | cut -c1-40)
BRANCH="claude/ST_NUMBER-$SLUG"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
```

### 4b. Implémenter le ticket
Effectue les modifications nécessaires en suivant les conventions du projet :
- Lire `IMPROVEMENTS.md` pour vérifier les règles applicables avant de coder
- Respecter l'architecture (pages / composants / hooks / services / types)
- Pas de commentaires sauf si la logique est obscure
- TypeScript strict

### 4c. Vérifier avant de commiter
```bash
bash scripts/check-rules.sh
npx tsc --noEmit
```
Corriger toutes les violations avant de continuer.

### 4d. Commiter
```bash
git add <fichiers modifiés>
git commit -m "fix: DESCRIPTION" # ou feat:, refactor:
```

Pour les migrations SQL, inclure dans le commit.

### 4e. Pousser
```bash
git push -u origin "$BRANCH"
```
En cas d'échec réseau, réessayer avec backoff (2s, 4s, 8s, 16s).

## 5. Créer la PR GitHub

Utilise le tool `mcp__github__create_pull_request` pour créer la PR :
- `owner` : `romaincouturier`
- `repo` : `super-tools`
- `head` : nom de la branche
- `base` : `main`
- `title` : `[ST_NUMBER] TITRE_DU_TICKET`
- `body` : description des changements, tests à effectuer, lien vers le ticket

Récupère l'URL de la PR dans la réponse (`html_url`).

## 6. Mettre à jour le ticket

Met à jour le ticket avec le statut `vibe_coding` et l'URL de la PR :
```bash
curl -sS -X PATCH \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.ST_NUMBER" \
  -d '{
    "status": "vibe_coding",
    "branch_url": "PR_URL",
    "updated_at": "NOW_ISO"
  }'
```

## 7. Résumé

Affiche :
- Ticket traité : numéro + titre
- Décision : implémenté OU questions posées
- Si implémenté : nom de la branche, lien PR, fichiers modifiés
- Si questions : les questions posées, ticket marqué "à discuter"

$ARGUMENTS
