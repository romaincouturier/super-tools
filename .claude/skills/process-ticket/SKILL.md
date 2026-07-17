---
name: process-ticket
description: "Analyse un ticket du kanban support de supertools, code le ticket si c'est faisable, pousse une branche et met à jour le ticket en vibe_coding avec le lien de la branche. Si le besoin est ambigu, écrit les questions dans le ticket et le laisse en qualification avec un point rouge (discussion_requested_at). Usage : /process-ticket ST-2026-XXXX"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion, Agent
---

Argument reçu : $ARGUMENTS

## 0. Variables d'environnement

Les credentials Supabase sont disponibles directement via les variables d'environnement :
- `SUPABASE_URL` (ou `VITE_SUPABASE_URL` en fallback local)
- `SUPABASE_SERVICE_ROLE_KEY`

```bash
SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
```

## 1. Récupérer le ticket

Extrait le numéro de ticket de l'argument (format `ST-YYYY-NNNN`).
Remplace les tirets par `%2D` uniquement dans la valeur du filtre de query string.

```bash
TICKET_NUM="$ARGUMENTS"  # ex: ST-2026-0186
TICKET_JSON=$(curl -sS \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.$TICKET_NUM&select=*")
echo "$TICKET_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(JSON.stringify(d[0]??null,null,2))"
```

Si le résultat est `null` : afficher une erreur et arrêter.

## 1bis. Récupérer les pièces jointes (images)

Le ticket peut contenir des captures d'écran essentielles à l'analyse :
`screenshot_url` sur le ticket, et les lignes de `support_ticket_attachments`.
Télécharger toutes les images puis les LIRE avec l'outil Read avant d'analyser.

```bash
TICKET_ID=$(echo "$TICKET_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d[0]?.id ?? '')")
mkdir -p /tmp/ticket-attachments

# Pièces jointes de la table support_ticket_attachments (bucket privé support-attachments)
curl -sS \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/support_ticket_attachments?ticket_id=eq.$TICKET_ID&select=file_name,file_path,mime_type" \
  | node -e "
    const rows = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    for (const r of rows) {
      if (r.mime_type && r.mime_type.startsWith('image/')) console.log(r.file_path + '|' + r.file_name);
    }" \
  | while IFS='|' read -r FILE_PATH FILE_NAME; do
      curl -sS -o "/tmp/ticket-attachments/$FILE_NAME" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        "$SUPABASE_URL/storage/v1/object/support-attachments/$FILE_PATH"
    done

ls -la /tmp/ticket-attachments/
```

Si `screenshot_url` est renseigné sur le ticket, le télécharger aussi (même
en-têtes d'authentification si l'URL pointe vers le storage Supabase).

Ensuite, pour CHAQUE image téléchargée : l'ouvrir avec l'outil Read. Les
captures montrent souvent le bug exact ou la maquette attendue — elles font
partie intégrante de la spécification du ticket.

## 2. Analyser le ticket

Lis les champs :
- `title`, `description`, `type` (bug | evolution), `priority`
- `ai_analysis` (analyse structurée disponible si non null)
- `page_url` (page concernée)
- `status` actuel

Consulte `IMPROVEMENTS.md` pour vérifier les règles applicables.

Pour une **évolution** : identifie les fichiers à modifier (pages, composants, hooks, services, types, migrations), évalue la faisabilité, estime la complexité.

Pour un **bug** : localise le code responsable, reproduis mentalement le bug, identifie la cause racine.

## 3. Décision : implémenter ou poser des questions

### Critères pour "implémenter"
- Description précise et non ambiguë
- Impact circonscrit (< 10 fichiers)
- Pas de changement de modèle de données complexe sans spécification

### Si des questions sont nécessaires

Formuler les questions de façon actionnable puis mettre à jour le ticket :

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -sS -X PATCH \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.$TICKET_NUM" \
  -d "{\"resolution_notes\": \"Questions Claude :\\n\\n1. ...\\n2. ...\", \"discussion_requested_at\": \"$NOW\", \"coding_status\": null, \"coding_error\": null, \"updated_at\": \"$NOW\"}"
```

Afficher les questions et arrêter.

## 4. Implémentation

### 4a. Créer la branche depuis main

```bash
git fetch origin main
git checkout -b "claude/$TICKET_NUM-$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | cut -c1-40)" origin/main
```

### 4b. Coder

Respecte l'architecture (pages / composants / hooks / services / types), TypeScript strict, pas de commentaires sauf si logique obscure. Vérifie `IMPROVEMENTS.md` avant chaque modification.

### 4c. Vérifier

```bash
bash scripts/check-rules.sh
npx tsc --noEmit
```

Corriger toutes les violations avant de continuer.

### 4d. Commiter

```bash
git add <fichiers modifiés>
git commit -m "fix: DESCRIPTION" # ou feat:
```

### 4e. Pousser

```bash
git push -u origin HEAD
```

Réessayer jusqu'à 4 fois avec backoff exponentiel en cas d'erreur réseau (2s, 4s, 8s, 16s).

## 5. Créer la PR avec gh

```bash
BRANCH=$(git branch --show-current)
PR_URL=$(gh pr create \
  --title "[$TICKET_NUM] $TITLE" \
  --body "$(cat <<'BODY'
## Ticket
$TICKET_NUM — $TITLE

## Changements
- ...

## Test
- ...
BODY
)" \
  --base main \
  --head "$BRANCH")
echo "PR créée : $PR_URL"
```

## 6. Mettre à jour le ticket

Rédiger d'abord la conclusion dans `/tmp/coding-summary.md`. Elle est affichée
dans le détail du ticket : c'est sur cette base que le staff décide de merger.
Structure imposée :

```bash
cat > /tmp/coding-summary.md <<'SUMMARY'
## Ce qui a été fait
(2-4 phrases : le comportement avant / après)

## Fichiers modifiés
- chemin/fichier.tsx : quoi et pourquoi

## Comment tester
1. Étapes concrètes dans l'app pour vérifier

## Points d'attention
(risques, limites, dette assumée — "Aucun" si rien)
SUMMARY

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
node -e "
const fs = require('fs');
fs.writeFileSync('/tmp/ticket-update.json', JSON.stringify({
  status: 'vibe_coding',
  branch_url: process.argv[1],
  coding_status: 'done',
  coding_error: null,
  coding_summary: fs.readFileSync('/tmp/coding-summary.md', 'utf8'),
  updated_at: process.argv[2],
}));
" "$PR_URL" "$NOW"

curl -sS -X PATCH \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  "$SUPABASE_URL/rest/v1/support_tickets?ticket_number=eq.$TICKET_NUM" \
  -d @/tmp/ticket-update.json
```

## 7. Résumé

Afficher :
- Ticket traité : numéro + titre
- Décision : implémenté OU questions posées
- Si implémenté : branche, lien PR, fichiers modifiés
- Si questions : les questions posées, point rouge posé sur le ticket

$ARGUMENTS
