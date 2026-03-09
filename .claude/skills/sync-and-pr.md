# Skill: sync-and-pr

## Description
Synchronise la branche courante avec `main`, gère les conflits, et pousse une Pull Request.

## Invocation
Commande : `/sync-and-pr`
Aliases : "synchronise ma branche", "sync avec main et PR", "merge main et PR"

## Instructions

Exécute les étapes suivantes dans l'ordre :

### 1. Vérifier l'état du repo
- Identifie la branche courante avec `git branch --show-current`
- Si on est sur `main`, refuse l'opération : "Tu es sur main, crée d'abord une branche feature."
- Vérifie s'il y a des changements non commités avec `git status`
- S'il y a des changements non commités, demande à l'utilisateur s'il veut les stasher ou les commiter avant de continuer

### 2. Mettre à jour main
- `git fetch origin main`
- En cas d'erreur réseau, réessaye jusqu'à 4 fois avec backoff exponentiel (2s, 4s, 8s, 16s)

### 3. Rebase sur main
- `git rebase origin/main`
- Si le rebase réussit sans conflit, passe à l'étape 4
- Si des **conflits** apparaissent :
  1. Liste les fichiers en conflit avec `git diff --name-only --diff-filter=U`
  2. Lis chaque fichier en conflit et analyse le contexte du code
  3. Résous les conflits intelligemment en préservant les changements des deux côtés quand c'est possible
  4. Pour chaque fichier résolu, fais `git add <fichier>`
  5. Continue le rebase avec `git rebase --continue`
  6. Répète si d'autres conflits apparaissent
  7. Si un conflit est trop ambigu pour être résolu automatiquement, montre les deux versions à l'utilisateur et demande quelle version garder

### 4. Pousser la branche
- `git push -u origin <nom-de-branche> --force-with-lease`
- Utilise `--force-with-lease` (pas `--force`) car le rebase réécrit l'historique mais on veut rester safe
- En cas d'erreur réseau, réessaye jusqu'à 4 fois avec backoff exponentiel

### 5. Créer ou mettre à jour la PR
- Vérifie si une PR existe déjà pour cette branche : `gh pr list --head <nom-de-branche> --json number,url`
- **Si aucune PR n'existe** : crée-la avec `gh pr create`
  - Titre : résumé concis des changements basé sur les commits de la branche
  - Body : liste les commits avec descriptions, mentionne que la branche est à jour avec main
  - Base branch : `main`
- **Si une PR existe déjà** : informe l'utilisateur que la PR est à jour avec le lien
- Affiche le lien de la PR à l'utilisateur

### 6. Résumé
Affiche un résumé :
- Branche synchronisée
- Nombre de conflits résolus (le cas échéant)
- Lien vers la PR
