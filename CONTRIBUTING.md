# Contributing to Super Tools

Merci de contribuer à `super-tools`.

Ce projet est fonctionnel, large, et encore en phase de clarification architecturelle. Une contribution utile n'est donc pas seulement une contribution qui "marche", mais une contribution qui reste lisible, sûre et compatible avec le reste du produit.

## Avant de commencer

Lire ces documents dans cet ordre :

1. [README.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\README.md)
2. [PRD.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\PRD.md)
3. [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)
4. [IMPROVEMENTS.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\IMPROVEMENTS.md)
5. [docs/architecture.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\architecture.md)

## Ce qu'on attend d'une bonne contribution

Une bonne contribution :

- résout un problème réel ou ajoute une amélioration claire
- respecte les conventions déjà présentes
- évite d'augmenter la dette structurelle
- documente les impacts quand ils sont transverses
- ajoute des tests quand le risque de régression le justifie

## Workflow recommandé

### 1. Choisir un scope serré

Préférer :

- une correction ciblée
- un refactor localisé
- une amélioration de documentation
- un lot cohérent de dette technique

Éviter :

- les refactors transverses sans filet
- les changements multi-modules sans raison forte
- les “cleanup” vagues sans objectif mesurable

### 2. Comprendre le domaine concerné

Avant de coder :

- lire la page React concernée dans `src/pages/`
- repérer les hooks utilisés
- repérer les services ou Edge Functions appelés
- vérifier si le domaine est déjà décrit dans le PRD

### 3. Vérifier les invariants existants

Le fichier [IMPROVEMENTS.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\IMPROVEMENTS.md) contient des règles de qualité acquises.

Ce ne sont pas des idées. Ce sont des invariants à respecter.

### 4. Développer avec un impact minimal

Quand c'est possible :

- garder les changements petits
- séparer refactor et changement fonctionnel
- ne pas mélanger documentation, nettoyage et feature dans le même lot

### 5. Vérifier avant de proposer

Commandes minimales :

```bash
npm run lint
npm run test
bash scripts/check-rules.sh
```

Si une commande ne peut pas être exécutée dans ton environnement, indique-le clairement dans la contribution.

## Conventions d'architecture

### Séparation des responsabilités

Règle cible :

- `src/pages/` : composition de page, routing, layout
- `src/components/` : UI et interactions locales
- `src/hooks/` : orchestration d'état et accès aux données
- `src/services/` : logique métier partagée et accès structurés
- `src/lib/` : utilitaires purs

### Règle importante

Éviter au maximum :

- `fetch()` direct dans les composants UI
- `supabase.from()` direct dans les composants UI
- logique métier longue dans les pages

Si tu ajoutes un nouveau flux de données, la bonne direction est généralement :

`page -> hook -> service -> supabase`

## Taille et découpage

Le repo contient déjà plusieurs gros fichiers. Merci de ne pas accentuer ce problème.

Repères de vigilance :

- page React : viser moins de 400 lignes
- hook métier : viser moins de 300 lignes
- composant UI : extraire tôt quand il commence à tout faire

Ce ne sont pas des limites absolues, mais si tu les dépasses, il faut une bonne raison.

## Sécurité

Le projet a des surfaces sensibles. Une contribution doit être prudente sur les points suivants :

- Edge Functions publiques
- CORS
- RLS
- auth apprenant
- indexation / agent IA
- routes tokenisées publiques

Quand une contribution touche :

- `supabase/config.toml`
- `supabase/functions/`
- `supabase/migrations/`
- `src/integrations/supabase/`

il faut expliciter l'impact sécurité dans la description du changement.

## Documentation attendue

Mettre à jour la documentation si nécessaire quand tu modifies :

- un parcours produit important
- une règle de contribution
- une architecture transverse
- un mécanisme sécurité

Les documents de référence sont :

- [README.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\README.md)
- [PRD.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\PRD.md)
- [docs/architecture.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\architecture.md)
- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)

## Règles de style utiles

- préférer les changements petits et explicables
- ne pas introduire de nouvelle abstraction “au cas où”
- mutualiser les utilitaires au lieu de copier-coller
- préférer une correction de cause racine à une logique de contournement
- conserver les patterns déjà validés quand ils sont bons

## Tests

Le projet n'a pas encore une couverture homogène. Donc :

- pour une correction de bug, ajouter un test si le bug peut revenir facilement
- pour un refactor structurel, ajouter au moins des tests ciblés sur les extractions
- pour une simple documentation, aucun test n'est attendu

## Changements à éviter sans discussion préalable

- refonte globale de l'auth
- changement de package manager officiel
- changement massif des conventions UI
- réorganisation complète des dossiers
- suppression large de migrations ou fonctions sans analyse

## Si tu utilises un agent ou une IA pour contribuer

Merci de t'assurer que l'agent :

- a lu le README et le PRD
- comprend la structure du repo
- respecte `IMPROVEMENTS.md`
- n'introduit pas de code mort ou de wrappers inutiles
- ne contourne pas un problème par complexification inutile

## Format conseillé pour une contribution

Une bonne proposition de changement explique brièvement :

- le problème traité
- le scope du changement
- les fichiers principaux touchés
- les risques connus
- les vérifications effectuées

## En cas de doute

Si tu hésites entre :

- ajouter une couche
- ou simplifier une couche existante

préférer la simplification.

