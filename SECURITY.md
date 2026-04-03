# Security Policy

Merci de contribuer à sécuriser `super-tools`.

Ce document décrit :

- comment signaler une vulnérabilité
- le modèle de sécurité général du projet
- les surfaces sensibles connues
- les limites actuelles à connaître avant d'exposer le projet plus largement

## Reporting d'une vulnérabilité

Merci de ne pas ouvrir d'issue publique pour une vulnérabilité exploitable.

En attendant la mise en place d'un canal dédié, la bonne pratique est :

- contacter le mainteneur du projet en privé
- fournir une description claire du problème
- fournir les étapes de reproduction
- préciser l'impact potentiel
- proposer, si possible, une mitigation temporaire

Merci d'inclure au minimum :

- la zone impactée
- le niveau d'accès nécessaire
- le scénario d'exploitation
- le type de données exposées ou modifiables

## Portée de la sécurité dans ce projet

`super-tools` est une application multi-surfaces :

- frontend React
- Supabase Auth
- tables PostgreSQL avec RLS
- Edge Functions Deno
- storage Supabase
- routes publiques tokenisées
- portail apprenant
- intégrations externes
- agent IA et indexation sémantique

Le modèle de sécurité repose donc sur plusieurs couches, et pas sur un seul mécanisme.

## Modèle d'accès attendu

### Utilisateur authentifié

Accès normal à ses données et fonctionnalités métier autorisées.

### Admin

Accès élargi à l'administration, aux paramètres sensibles et à certains écrans d'exploitation.

### Public / anon

Accès uniquement à des parcours explicitement conçus pour cela :

- formulaires tokenisés
- signatures
- certaines pages d'information publique
- certains webhooks ou callbacks techniques

### Apprenant

Accès restreint à son espace d'apprentissage et à ses contenus associés.

## Surfaces sensibles connues

Les zones suivantes doivent être considérées comme sensibles :

- [supabase/config.toml](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\config.toml)
- [supabase/functions](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions)
- [supabase/migrations](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\migrations)
- [src/integrations/supabase/client.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\client.ts)

### 1. Edge Functions exposées

Le projet utilise un grand nombre d'Edge Functions.

À date, beaucoup sont configurées avec `verify_jwt = false` dans [supabase/config.toml](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\config.toml).

Cela ne signifie pas automatiquement qu'elles sont vulnérables, mais cela signifie qu'elles doivent être examinées comme des surfaces publiques ou semi-publiques.

Toute contribution touchant :

- auth
- emails
- signatures
- agent IA
- webhooks
- portail apprenant

doit partir de ce constat.

### 2. CORS

La configuration partagée actuelle dans [supabase/functions/_shared/cors.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\_shared\cors.ts) utilise encore `Access-Control-Allow-Origin: "*"`.

Pour un projet open source ou exposé plus largement, cela doit être considéré comme un point de durcissement prioritaire.

### 3. RLS

Le projet s'appuie fortement sur les policies RLS Supabase.

Les parcours publics et semi-publics doivent être examinés avec soin, notamment :

- questionnaires
- évaluations
- signatures
- réclamations
- portail apprenant

Toute policy publique permissive ou basée sur une hypothèse implicite doit être considérée comme suspecte jusqu'à preuve du contraire.

### 4. Portail apprenant

Le portail apprenant utilise actuellement un mode d'accès basé sur un header `x-learner-email` dans [src/integrations/supabase/client.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\client.ts).

Ce mécanisme existe, mais il doit être considéré comme une zone à auditer et à renforcer.

Une contribution qui touche ce flux doit décrire explicitement :

- le modèle de confiance
- le type d'usurpation possible
- la manière dont la RLS protège réellement les données

### 5. Agent IA et RAG

Les surfaces suivantes sont particulièrement sensibles :

- `agent-chat`
- `index-documents`
- `process-indexation-queue`
- la table `document_embeddings`
- toute RPC de lecture transverse

Ces briques manipulent :

- des contenus issus de plusieurs domaines
- des recherches sémantiques
- des lectures transverses
- des exécutions potentielles d'actions

Toute contribution sur cette zone doit être traitée comme une contribution sécurité.

### 6. Storage et documents

Le projet stocke :

- documents de formation
- médias
- PDF
- screenshots
- pièces jointes CRM ou support

Quand un changement touche le storage, il faut vérifier :

- les policies de bucket
- les URLs publiques
- les uploads signés
- les suppressions et orphelins

## Ce que les contributeurs doivent faire

Quand une contribution touche une surface sensible, la description doit préciser :

- le comportement avant
- le comportement après
- qui peut appeler ou lire la ressource
- quels contrôles d'accès existent
- quels tests ou vérifications ont été réalisés

## Bonnes pratiques de contribution sécurité

- ne pas ajouter une fonction publique sans justification explicite
- ne pas utiliser `USING (true)` sur des données sensibles accessibles publiquement
- ne pas conserver `*` dans CORS pour la production
- ne pas supposer qu'un flux public est sûr simplement parce qu'il "semble interne"
- préférer un contrôle explicite à une convention implicite

## Limitations connues à ce jour

À date de rédaction, le projet a encore plusieurs sujets de durcissement ouverts :

- trop de functions avec `verify_jwt = false`
- CORS trop large
- revue sécurité encore incomplète sur l'agent IA et l'indexation
- modèle d'accès apprenant à revoir
- dette historique sur certaines policies RLS

Ces sujets sont suivis dans :

- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)

Le but de ce document n'est pas de masquer ces limites, mais de les rendre explicites pour des contributeurs externes.

## Secrets et données sensibles

Ne jamais commiter :

- clés de service
- tokens d'API
- exports de base
- dumps contenant des données personnelles
- secrets de webhook

Les fichiers `.env*` sont ignorés par git, mais cela ne remplace pas la prudence.

## Politique de publication

Avant une diffusion large en open source, il est recommandé de vérifier au minimum :

- les Edge Functions réellement publiques
- les routes publiques tokenisées
- les buckets et policies storage
- les flows apprenants
- l'agent IA et ses accès transverses
- les valeurs de fallback et variables d'environnement exposées

## En résumé

Le projet peut devenir contributable en open source, mais il ne faut pas le présenter comme "sécurisé par défaut" sans travail complémentaire.

La bonne posture est :

- documenter honnêtement les limites
- traiter les contributions sécurité sérieusement
- durcir progressivement les surfaces les plus exposées

