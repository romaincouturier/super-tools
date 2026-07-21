---
name: process-ticket
description: "Analyse un ticket du kanban support de supertools, code le ticket si c'est faisable, pousse une branche et met à jour le ticket en vibe_coding avec le lien de la branche. Si le besoin est ambigu, écrit les questions dans le ticket et le laisse en qualification avec un point rouge (discussion_requested_at). Usage : /process-ticket ST-2026-XXXX"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion, Agent
---

Argument reçu : $ARGUMENTS

## 0. Variables d'environnement

L'accès à la base ne se fait plus via `SUPABASE_SERVICE_ROLE_KEY` (inaccessible
sur Lovable Cloud). On passe par deux edge functions dédiées, authentifiées via
un shared secret :

- `TICKET_FETCH_URL` : `GET ?ticket_number=...` → renvoie le ticket + pièces jointes (signed URLs)
- `TICKET_STATUS_URL` : `POST` → met à jour le ticket (status, coding_status, branch_url, coding_summary, resolution_notes, discussion_requested_at)
- `TICKET_STATUS_WEBHOOK_SECRET` : passé en en-tête `x-webhook-secret`

## 1. Récupérer le ticket + pièces jointes

```bash
TICKET_NUM="$ARGUMENTS"  # ex: ST-2026-0186
PAYLOAD=$(curl -sS \
  -H "x-webhook-secret: $TICKET_STATUS_WEBHOOK_SECRET" \
  "$TICKET_FETCH_URL?ticket_number=$TICKET_NUM")
echo "$PAYLOAD" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(JSON.stringify(d.ticket ?? null, null, 2))"
```

Si `ticket` est `null` : afficher une erreur et arrêter.

## 1bis. Télécharger les pièces jointes (images)

Le payload contient `attachments: [{ file_name, mime_type, signed_url }]`.
Télécharger toutes les images puis les LIRE avec l'outil Read avant d'analyser.

```bash
mkdir -p /tmp/ticket-attachments
echo "$PAYLOAD" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  for (const a of (d.attachments ?? [])) {
    if (a.mime_type && a.mime_type.startsWith('image/') && a.signed_url) {
      console.log(a.signed_url + '|' + a.file_name);
    }
  }" \
  | while IFS='|' read -r URL FILE_NAME; do
      curl -sS -o "/tmp/ticket-attachments/$FILE_NAME" "$URL"
    done
ls -la /tmp/ticket-attachments/
```

Puis pour CHAQUE image : l'ouvrir avec l'outil Read. Les captures font partie
intégrante de la spécification du ticket.



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
curl -sS -X POST \
  -H "x-webhook-secret: $TICKET_STATUS_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  "$TICKET_STATUS_URL" \
  -d "{\"ticket_number\": \"$TICKET_NUM\", \"resolution_notes\": \"Questions Claude :\\n\\n1. ...\\n2. ...\", \"discussion_requested_at\": \"$NOW\", \"coding_status\": \"\", \"coding_error\": null}"
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
  ticket_number: process.argv[3],
  status: 'vibe_coding',
  branch_url: process.argv[1],
  coding_status: 'done',
  coding_error: null,
  coding_summary: fs.readFileSync('/tmp/coding-summary.md', 'utf8'),
}));
" "$PR_URL" "$NOW" "$TICKET_NUM"

curl -sS -X POST \
  -H "x-webhook-secret: $TICKET_STATUS_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  "$TICKET_STATUS_URL" \
  -d @/tmp/ticket-update.json
```

## 7. Résumé

Afficher :
- Ticket traité : numéro + titre
- Décision : implémenté OU questions posées
- Si implémenté : branche, lien PR, fichiers modifiés
- Si questions : les questions posées, point rouge posé sur le ticket

$ARGUMENTS
