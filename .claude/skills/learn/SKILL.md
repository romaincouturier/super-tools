---
name: learn
description: "Capture un constat ou une question récente en item d'amélioration continue dans IMPROVEMENTS.md. Utiliser après avoir posé une question sur le code, identifié un pattern dupliqué, ou repéré une dette technique."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

Tu viens de répondre à une question de l'utilisateur ou d'identifier un constat sur la codebase.
Ton rôle est de transformer ce constat en item actionnable dans le backlog d'amélioration continue.

## 1. Analyser le contexte de la conversation

- Relis les derniers échanges de la conversation pour identifier le **constat** (ce qui a été observé ou demandé)
- Identifie la **catégorie** :
  - `duplication` — code dupliqué qui pourrait être mutualisé
  - `architecture` — violation ou amélioration architecturale
  - `pattern` — pattern existant à généraliser ou documenter
  - `dette` — dette technique à résorber
  - `convention` — convention manquante ou non respectée
  - `performance` — optimisation possible
  - `securite` — point de sécurité à renforcer
  - `dx` — amélioration de l'expérience développeur (tooling, skills, etc.)

## 2. Qualifier l'item

- Demande à l'utilisateur (avec AskUserQuestion) :
  - **Priorité** : haute (à traiter au prochain sprint), moyenne (à planifier), basse (quand on a le temps)
  - **Scope** : est-ce que l'utilisateur veut ajouter des détails ou un contexte supplémentaire ?

## 3. Écrire dans IMPROVEMENTS.md

- Lis le fichier `IMPROVEMENTS.md` à la racine du projet
- Ajoute un nouvel item **en haut** de la section correspondante (catégorie)
- Si la section n'existe pas encore, crée-la

Format d'un item :
```markdown
### [CATÉGORIE-NNN] Titre court et actionnable
- **Constat** : description factuelle de ce qui a été observé
- **Fichiers concernés** : liste des fichiers identifiés lors de l'analyse
- **Action suggérée** : ce qu'il faudrait faire concrètement
- **Priorité** : haute | moyenne | basse
- **Origine** : question/constat qui a mené à cet item
- **Date** : YYYY-MM-DD
```

- Pour le numéro `NNN`, incrémente le dernier numéro trouvé dans le fichier (toutes catégories confondues). S'il n'y en a pas, commence à 001.

## 4. Vérifier la cohérence

- Vérifie qu'il n'y a pas de doublon (item similaire déjà présent dans le backlog)
- Si un item similaire existe, propose de le mettre à jour plutôt que d'en créer un nouveau

## 5. Résumé

Affiche un résumé court :
- L'item ajouté (titre + catégorie + priorité)
- Le nombre total d'items dans le backlog par priorité (haute/moyenne/basse)

$ARGUMENTS
