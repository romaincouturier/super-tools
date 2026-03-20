---
name: learn
description: "Capture un constat ou une question récente comme règle d'amélioration continue dans IMPROVEMENTS.md. Utiliser après avoir posé une question sur le code, identifié un pattern, ou corrigé un bug révélateur."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

Tu viens de répondre à une question de l'utilisateur ou d'identifier un constat sur la codebase.
Ton rôle est de transformer ce constat en **règle acquise** : une leçon apprise que le système doit vérifier en permanence à partir de maintenant.

Ce ne sont PAS des tickets de backlog. Ce sont des **invariants** — des choses qu'on a découvertes et qu'on ne veut plus jamais oublier.

## 1. Analyser le contexte de la conversation

- Relis les derniers échanges pour identifier le **constat** (ce qui a été observé, demandé, ou corrigé)
- Identifie la **catégorie** :
  - `duplication` — code dupliqué qui doit rester mutualisé
  - `architecture` — règle architecturale à respecter
  - `pattern` — pattern standard à suivre pour un besoin donné
  - `convention` — convention de code à appliquer systématiquement
  - `securite` — point de sécurité à vérifier en permanence
  - `dx` — amélioration de l'expérience développeur

## 2. Demander du contexte si nécessaire

- Si le constat est ambigu ou incomplet, utilise AskUserQuestion pour clarifier
- Ne demande PAS de priorité — toutes les règles sont à vérifier en permanence
- Demande seulement si l'utilisateur veut ajouter du contexte supplémentaire

## 3. Écrire dans IMPROVEMENTS.md

- Lis le fichier `IMPROVEMENTS.md` à la racine du projet
- Ajoute la nouvelle règle **en haut** de la section correspondante (catégorie)
- Si la section n'existe pas encore, crée-la

Format d'une règle :
```markdown
### [NNN] Titre court — la règle en une phrase
- **Constat** : ce qui a été observé ou le bug qui a révélé le problème
- **Règle** : ce qu'il faut toujours faire / ne jamais faire
- **Vérification** : comment vérifier que la règle est respectée (grep, pattern à chercher, etc.)
- **Fichiers de référence** : les fichiers qui implémentent correctement le pattern
- **Origine** : question ou bug qui a mené à cette règle
- **Date** : YYYY-MM-DD
```

- Pour le numéro `NNN`, incrémente le dernier numéro trouvé dans le fichier (toutes catégories confondues). S'il n'y en a pas, commence à 001.

## 4. Vérifier la cohérence

- Vérifie qu'il n'y a pas de doublon (règle similaire déjà présente)
- Si une règle similaire existe, enrichis-la avec le nouveau constat plutôt que d'en créer une nouvelle

## 5. Résumé

Affiche un résumé court :
- La règle ajoutée (titre + catégorie)
- Le nombre total de règles dans le fichier

$ARGUMENTS
