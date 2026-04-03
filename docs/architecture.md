# Architecture Overview

Ce document explique comment penser le repo `super-tools`.

Il ne cherche pas à décrire chaque fichier. Il sert à aider un développeur externe ou un agent externe à comprendre :

- où se trouve quoi
- quelle couche est responsable de quoi
- où faire un changement
- quelles zones sont sensibles

## 1. Vue d'ensemble

`super-tools` est une application full-stack centrée sur Supabase.

Elle combine :

- un frontend React/TypeScript
- une base PostgreSQL Supabase
- des Edge Functions Deno
- des policies RLS
- du storage Supabase
- des intégrations externes

Le repo est organisé autour d'un frontend principal, avec Supabase embarqué dans le même dépôt.

## 2. Carte du repo

### Frontend

- [src/pages](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\pages)
- [src/components](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components)
- [src/hooks](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\hooks)
- [src/services](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\services)
- [src/lib](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\lib)
- [src/integrations/supabase](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase)
- [src/types](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\types)

### Backend

- [supabase/migrations](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\migrations)
- [supabase/functions](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions)
- [supabase/config.toml](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\config.toml)

### Documentation

- [README.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\README.md)
- [PRD.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\PRD.md)
- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)
- [IMPROVEMENTS.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\IMPROVEMENTS.md)

## 3. Point d'entrée frontend

Les points d'entrée principaux sont :

- [src/main.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\main.tsx)
- [src/App.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\App.tsx)

[src/App.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\App.tsx) contient :

- le `QueryClient`
- la persistance du cache
- le routeur
- les providers UI globaux
- la déclaration des routes

Point produit important :

- `/dashboard` redirige actuellement vers `/agent`

## 4. Modèle de couches recommandé

Le repo n'est pas encore parfaitement homogène, mais le modèle cible recommandé est le suivant.

### Pages

Les pages dans `src/pages/` :

- branchent le layout
- lisent les paramètres de route
- orchestrent les composants principaux
- déclenchent les hooks du domaine

Une page ne devrait pas concentrer la logique métier longue.

### Components

Les composants dans `src/components/` :

- gèrent le rendu
- gèrent les interactions locales
- composent les primitives UI

Un composant ne devrait idéalement pas être responsable d'un accès backend direct.

### Hooks

Les hooks dans `src/hooks/` :

- lisent ou écrivent les données
- encapsulent les queries et mutations
- gèrent les états d'orchestration
- exposent une API plus propre aux pages/composants

### Services

Les fichiers dans `src/services/` :

- centralisent une logique métier réutilisable
- servent de point de mutualisation quand plusieurs hooks ou composants ont besoin du même comportement

### Lib

Les fichiers dans `src/lib/` :

- doivent rester majoritairement purs
- contiennent des utilitaires ou transformations
- ne doivent pas dériver vers des couches métier trop opaques

## 5. Organisation par domaine

Le frontend est structuré principalement par domaine métier.

Exemples :

- `formations`
- `crm`
- `missions`
- `content`
- `quotes`
- `reseau`
- `watch`
- `settings`
- `support`
- `media`

Quand tu contribues, pars d'abord du domaine métier, pas d'une recherche globale de composants similaires.

## 6. Flux de données typique

Le flux le plus sain dans ce repo ressemble à :

```text
page
-> composant métier
-> hook de domaine
-> service ou client Supabase
-> table / RPC / edge function
```

Le repo contient encore des écarts à ce modèle, mais toute nouvelle contribution devrait aller dans cette direction.

## 7. Supabase côté frontend

Le client principal se trouve dans :

- [src/integrations/supabase/client.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\client.ts)

Les types générés se trouvent dans :

- [src/integrations/supabase/types.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\types.ts)

### Point important

Le repo utilise largement Supabase directement depuis le front.

C'est pratique, mais cela a deux conséquences :

- le couplage UI <-> base est fort
- toute modification de schéma peut avoir de nombreux impacts

Avant de modifier une table ou une RPC, il faut rechercher les usages dans :

- `src/hooks`
- `src/components`
- `src/pages`
- `supabase/functions`

## 8. Edge Functions

Les Edge Functions sont nombreuses et servent à plusieurs types de besoins :

- emails transactionnels
- IA et génération de contenu
- webhooks
- traitement batch / reminders
- intégrations externes
- agent IA et indexation

Le dossier partagé :

- [supabase/functions/_shared](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\_shared)

contient les utilitaires communs.

### Zones particulièrement sensibles

- `agent-chat`
- `index-documents`
- `process-indexation-queue`
- tout ce qui touche les signatures
- tout ce qui touche les emails
- tout ce qui touche les accès apprenants

## 9. Migrations

Le dossier [supabase/migrations](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\migrations) est large et historique.

Conséquences :

- il ne faut pas raisonner uniquement à partir d'une migration ancienne
- certaines corrections viennent compenser des ouvertures antérieures
- l'état final est parfois difficile à déduire sans audit ciblé

Quand tu touches aux migrations :

- documente le pourquoi
- explicite l'impact RLS
- explicite l'impact storage
- explicite l'impact frontend ou function

## 10. Modules transverses importants

Certains modules ne sont pas juste “une page de plus”. Ils traversent plusieurs domaines.

### Agent

- chat
- requêtes SQL
- recherche sémantique
- indexation de contenus

### Emails

- envoi
- scheduling
- retry
- tracking
- inbound processing

### Media / documents

- upload
- storage
- metadata
- visualisation

### Auth et accès

- utilisateur authentifié
- admin
- parcours publics tokenisés
- apprenant

## 11. Où intervenir selon le besoin

### Ajouter ou corriger un écran

Commencer par :

- `src/pages/`
- puis `src/components/<domaine>/`
- puis les hooks associés

### Corriger un comportement métier partagé

Commencer par :

- `src/hooks/`
- `src/services/`
- `src/lib/`

### Corriger un schéma ou une policy

Commencer par :

- `supabase/migrations/`
- puis vérifier les impacts front et functions

### Corriger une intégration ou un traitement serveur

Commencer par :

- `supabase/functions/`
- puis vérifier les appels côté frontend

## 12. Dette connue

Quelques faits utiles à connaître avant de contribuer :

- plusieurs composants et hooks sont encore trop gros
- beaucoup de fichiers importent directement le client Supabase
- les couches ne sont pas encore homogènes partout
- la documentation vient juste d'être remise à niveau
- la sécurité de certaines surfaces doit encore être durcie

Le plan de remise à plat est documenté dans :

- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)

## 13. Règles pratiques pour un contributeur externe

- commencer petit
- toucher le moins de domaines possible par PR
- ne pas ajouter de nouvelle abstraction sans besoin concret
- ne pas déplacer des dossiers massivement sans discussion
- éviter d'introduire de nouveaux accès backend dans les composants UI
- mettre à jour la doc si le changement touche un comportement transverse

## 14. Résumé mental simple

Si tu dois retenir une seule chose :

`super-tools` est un produit métier large, structuré par domaines, avec Supabase au centre.

La meilleure manière de contribuer proprement est de :

- partir du domaine concerné
- suivre le flux page -> hook -> service -> backend
- éviter d'épaissir encore la dette structurelle

