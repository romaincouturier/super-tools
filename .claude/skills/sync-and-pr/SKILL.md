---
name: sync-and-pr
description: Synchronise la branche courante avec main, gère les conflits de rebase, vérifie la couverture de tests, enrichit les zones non couvertes, refactorise le code dupliqué, et pousse une Pull Request. Utiliser quand l'utilisateur veut synchroniser sa branche, merger main, ou créer une PR après sync.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

Exécute les étapes suivantes dans l'ordre :

## 1. Vérifier l'état du repo
- Identifie la branche courante avec `git branch --show-current`
- Si on est sur `main`, refuse l'opération : "Tu es sur main, crée d'abord une branche feature."
- Vérifie s'il y a des changements non commités avec `git status`
- S'il y a des changements non commités, demande à l'utilisateur s'il veut les stasher ou les commiter avant de continuer

## 2. Mettre à jour main
- `git fetch origin main`
- En cas d'erreur réseau, réessaye jusqu'à 4 fois avec backoff exponentiel (2s, 4s, 8s, 16s)

## 3. Rebase sur main
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

## 4. Contrôle d'exhaustivité des tests et enrichissement

### 4a. Identifier les fichiers modifiés sur la branche
- Liste les fichiers source modifiés (ajoutés, modifiés) par rapport à `origin/main` :
  `git diff --name-only --diff-filter=AM origin/main...HEAD -- 'src/**/*.ts' 'src/**/*.tsx' 'supabase/**/*.ts'`
- Exclure de cette liste : fichiers de test (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`), fichiers de config, fichiers de types purs (`*.d.ts`), et fichiers de style
- Si aucun fichier source n'est modifié, passer directement à l'étape 5

### 4b. Lancer les tests existants avec couverture
- Exécuter les tests avec rapport de couverture sur les fichiers modifiés :
  `npx vitest run --coverage --coverage.include='<patterns des fichiers modifiés>' --coverage.reporter=text --coverage.reporter=json`
- Analyser la sortie pour identifier :
  - Le pourcentage de couverture par fichier (lignes, branches, fonctions)
  - Les lignes et branches non couvertes spécifiquement

### 4c. Analyser les zones non couvertes
- Pour chaque fichier modifié ayant une couverture < 80% en lignes OU < 70% en branches :
  1. Lire le fichier source pour comprendre la logique non couverte
  2. Identifier les cas de figure manquants : branches conditionnelles, cas d'erreur, edge cases, fonctions non testées
  3. Catégoriser les zones non couvertes :
     - **Critique** : logique métier, calculs, transformations de données
     - **Important** : gestion d'erreurs, validations, cas limites
     - **Optionnel** : code UI pur, logs, formatage simple

### 4d. Enrichir les tests
- Pour les zones **critiques** et **importantes** non couvertes :
  1. Vérifier si un fichier de test existe déjà pour le fichier source (même nom avec `.test.ts(x)`)
  2. **Si un fichier de test existe** : ajouter les cas de test manquants dans les `describe` blocks existants
  3. **Si aucun fichier de test n'existe** : créer un nouveau fichier de test adjacent au fichier source, en suivant les conventions du projet (imports, setup, structure `describe`/`it`)
  4. Les tests doivent :
     - Couvrir les branches conditionnelles non testées
     - Tester les cas d'erreur et les edge cases
     - Utiliser des noms descriptifs en français ou anglais selon la convention existante
     - Ne pas mocker excessivement — préférer tester le comportement réel
     - Suivre le pattern AAA (Arrange, Act, Assert)
  5. Demander à l'utilisateur avant de créer plus de 3 nouveaux fichiers de test

### 4e. Valider les tests enrichis
- Relancer la suite de tests complète : `npx vitest run`
- Si des tests échouent :
  1. Analyser l'erreur
  2. Corriger le test (pas le code source, sauf si le test révèle un vrai bug)
  3. Relancer jusqu'à ce que tous les tests passent
- Relancer la couverture sur les fichiers modifiés pour vérifier l'amélioration
- Afficher un tableau comparatif avant/après de la couverture

### 4f. Commiter les nouveaux tests
- Si des tests ont été ajoutés ou modifiés :
  `git add <fichiers de test>`
  `git commit -m "test: add/improve tests for <description des fichiers couverts>"`

## 5. Détection et refactorisation du code dupliqué

### 5a. Détecter le code dupliqué dans les fichiers modifiés
- Reprendre la liste des fichiers source modifiés identifiés à l'étape 4a
- Si aucun fichier source n'a été modifié, passer directement à l'étape 6
- Pour chaque fichier modifié, rechercher les duplications :
  1. **Duplication interne** : blocs de code répétés au sein du même fichier (≥ 3 lignes similaires apparaissant 2+ fois)
  2. **Duplication inter-fichiers** : extraire les signatures de fonctions, patterns et blocs logiques significatifs des fichiers modifiés, puis les rechercher dans le reste du projet avec `Grep` :
     - Chercher des fonctions avec une logique similaire dans `src/` et `supabase/`
     - Chercher des patterns copy-paste (mêmes structures conditionnelles, mêmes transformations de données)
  3. **Constantes et valeurs magiques** : repérer les valeurs littérales (strings, nombres) utilisées à plusieurs endroits qui devraient être des constantes partagées

### 5b. Évaluer les duplications trouvées
- Pour chaque duplication détectée, évaluer :
  - **Impact** : combien de fichiers/lignes sont concernés
  - **Risque** : la duplication peut-elle causer des incohérences si un seul endroit est modifié ?
  - **Faisabilité** : la refactorisation est-elle simple et safe, ou risque-t-elle d'introduire des régressions ?
- Classer les duplications :
  - **À refactoriser** : logique métier dupliquée, helpers copiés-collés, constantes répétées — refactorisation simple et bénéfique
  - **À signaler** : duplication structurelle plus profonde qui nécessiterait un refactoring plus large — informer l'utilisateur sans modifier
  - **À ignorer** : duplication acceptable (code de test, boilerplate framework, patterns idiomatiques volontaires)

### 5c. Refactoriser les duplications simples
- Pour chaque duplication classée **à refactoriser** :
  1. **Extraire** la logique commune dans une fonction/constante/type partagé :
     - Utilitaires → `src/lib/` (dans un fichier existant pertinent, ou nouveau si nécessaire)
     - Constantes → fichier de constantes existant le plus proche, ou nouveau `constants.ts` dans le dossier concerné
     - Types partagés → fichier de types existant ou nouveau dans le même dossier
     - Hooks React dupliqués → `src/hooks/`
  2. **Remplacer** chaque occurrence par un import de l'élément extrait
  3. **Vérifier** que les imports sont corrects et que le code compile : `npx tsc --noEmit` (limité aux fichiers concernés si possible)
  4. Demander confirmation à l'utilisateur avant de refactoriser si le changement touche plus de 5 fichiers

### 5d. Valider la refactorisation
- Relancer la suite de tests complète : `npx vitest run`
- Si des tests échouent :
  1. Analyser si l'échec est lié à la refactorisation
  2. Corriger le code refactorisé ou les imports manquants
  3. Relancer jusqu'à ce que tous les tests passent
- Vérifier qu'aucune régression de couverture n'a été introduite

### 5e. Commiter la refactorisation
- Si des fichiers ont été refactorisés :
  `git add <fichiers modifiés>`
  `git commit -m "refactor: extract <description> to reduce duplication"`
- Si des duplications ont été classées **à signaler**, les lister dans la sortie pour l'utilisateur

## 6. Pousser la branche
- `git push -u origin <nom-de-branche> --force-with-lease`
- Utilise `--force-with-lease` (pas `--force`) car le rebase réécrit l'historique mais on veut rester safe
- En cas d'erreur réseau, réessaye jusqu'à 4 fois avec backoff exponentiel

## 7. Créer ou mettre à jour la PR
- Vérifie si une PR existe déjà pour cette branche : `gh pr list --head <nom-de-branche> --json number,url`
- **Si aucune PR n'existe** : crée-la avec `gh pr create`
  - Titre : résumé concis des changements basé sur les commits de la branche
  - Body : liste les commits avec descriptions, mentionne que la branche est à jour avec main, et inclut le résumé de couverture des tests
  - Base branch : `main`
- **Si une PR existe déjà** : informe l'utilisateur que la PR est à jour avec le lien
- Affiche le lien de la PR à l'utilisateur

## 8. Résumé
Affiche un résumé :
- Branche synchronisée
- Nombre de conflits résolus (le cas échéant)
- Couverture des tests : tableau des fichiers modifiés avec % couverture avant/après
- Nombre de tests ajoutés/modifiés
- Duplications refactorisées (le cas échéant) et duplications signalées à traiter
- Lien vers la PR

$ARGUMENTS
