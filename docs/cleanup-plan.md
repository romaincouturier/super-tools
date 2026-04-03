# Plan de nettoyage de `super-tools`

> Basé sur l'état de `main` GitHub au commit `74531fa6eb9ca5d2109e41b3e05cf2f69868a75d`
> Date d'audit : 2026-04-01

## Objectif

Repartir sur une base saine, plus sûre et plus maintenable, avant de continuer à ajouter des fonctionnalités.

Ce plan privilégie :

- la réduction du risque sécurité
- la clarification de l'architecture
- la baisse du coût de maintenance
- l'ajout de garde-fous pour éviter une nouvelle dérive

---

## Résumé exécutif

Les problèmes les plus critiques observés :

- trop de fonctions Supabase exposées avec `verify_jwt = false`
- CORS globalement ouvert avec `Access-Control-Allow-Origin: "*"`
- nouvelles briques `agent-chat` / `RAG` ajoutées sur une base sécurité déjà fragile
- table `document_embeddings` lisible par tous les utilisateurs authentifiés
- RPC `agent_sql_query` en `SECURITY DEFINER`
- accès Supabase trop diffus dans le frontend
- documentation racine confuse et outillage ambigu
- trop gros fichiers / hooks / composants, peu de tests pour la taille du projet

Décision recommandée :

- geler les nouvelles features non critiques
- traiter d'abord la sécurité et le contrat d'architecture
- ensuite seulement engager les refactors structurels

---

## Principes de nettoyage

1. Fermer avant d'ouvrir.
2. Réduire la surface publique par défaut.
3. Déplacer la logique métier hors des composants UI.
4. Éviter les refactors "esthétiques" sans tests ni garde-fous.
5. Remplacer les documents dispersés par une documentation courte et fiable.

---

## Phase 0 - Gel et baseline

### Objectif

Créer un cadre de travail sûr avant de modifier la structure.

### Actions

- Créer une branche dédiée de stabilisation.
- Geler les nouvelles features sauf correctifs urgents.
- Produire un inventaire initial :
  - Edge Functions publiques
  - policies RLS `anon` et `authenticated USING (true)`
  - buckets publics
  - composants/pages/hooks les plus gros
  - accès directs à Supabase dans `src/components` et `src/hooks`
- Créer un document de baseline dans `docs/cleanup-baseline.md`.

### Tickets

- `CLN-000` Créer la branche de nettoyage
- `CLN-001` Écrire la baseline de dette technique
- `CLN-002` Lister les surfaces publiques effectives

### Critères d'acceptation

- une baseline existe dans le repo
- les points critiques sont listés noir sur blanc
- l'équipe travaille depuis une branche dédiée

---

## Phase 1 - Sécurité immédiate

### Objectif

Réduire le risque d'exposition avant tout refactor fonctionnel.

### Priorité

`P0`

### Chantiers

#### 1.1 CORS

- Remplacer `Access-Control-Allow-Origin: "*"` par une liste d'origines autorisées.
- Gérer séparément les cas webhook réellement publics.

Tickets :

- `SEC-001` Restreindre [cors.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\_shared\cors.ts)
- `SEC-002` Documenter les exceptions CORS légitimes

#### 1.2 Edge Functions ouvertes

- Auditer [config.toml](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\config.toml).
- Pour chaque `verify_jwt = false`, choisir l'un des statuts :
  - requis publiquement
  - doit être protégé par JWT
  - doit être protégé par signature ou secret webhook
  - obsolète

Tickets :

- `SEC-003` Cartographier toutes les functions en `verify_jwt = false`
- `SEC-004` Protéger les functions qui ne devraient pas être publiques
- `SEC-005` Supprimer ou archiver les functions obsolètes

#### 1.3 Agent / RAG

- Auditer `agent-chat`, `index-documents`, `process-indexation-queue`.
- Vérifier le modèle d'autorisation réel bout en bout.
- Vérifier que les données indexées restent cloisonnées.

Tickets :

- `SEC-006` Auditer [agent-chat](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\agent-chat\index.ts)
- `SEC-007` Auditer [index-documents](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\index-documents\index.ts)
- `SEC-008` Auditer [process-indexation-queue](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\process-indexation-queue\index.ts)
- `SEC-009` Geler toute extension IA tant que l'audit n'est pas clos

#### 1.4 `document_embeddings`

- Revoir la policy `FOR SELECT TO authenticated USING (true)`.
- Ajouter un mécanisme de filtrage par propriétaire, tenant, ou périmètre d'accès.
- Vérifier que chaque document indexé transporte un contexte d'autorisation exploitable.

Tickets :

- `SEC-010` Corriger la RLS de `document_embeddings`
- `SEC-011` Enrichir l'index avec des métadonnées d'autorisation
- `SEC-012` Ajouter des tests d'accès croisé

#### 1.5 `agent_sql_query`

- Revoir la nécessité du `SECURITY DEFINER`.
- Limiter plus fortement le périmètre requêtable.
- Empêcher toute lecture de tables non prévues.

Tickets :

- `SEC-013` Auditer la RPC `agent_sql_query`
- `SEC-014` Restreindre les tables accessibles
- `SEC-015` Ajouter des tests SQL négatifs

### Critères d'acceptation

- CORS n'accepte plus `*` en production
- la liste des functions publiques est volontaire et documentée
- la lecture de `document_embeddings` n'est plus globale
- la surface agent n'offre plus de lecture trop large par défaut

---

## Phase 2 - Contrat de sécurité applicatif

### Objectif

Rendre cohérente la frontière d'accès entre public, apprenant, authentifié et admin.

### Priorité

`P0`

### Chantiers

#### 2.1 Parcours publics tokenisés

- Vérifier questionnaires, évaluations, signatures, réclamations.
- Remplacer toute policy trop large par des validations token explicites.

Tickets :

- `SEC-020` Auditer tous les parcours publics
- `SEC-021` Supprimer les policies `anon` trop permissives

#### 2.2 Portail apprenant

- Auditer la logique `x-learner-email`.
- Évaluer un remplacement par token signé, session dédiée ou magic link court.

Tickets :

- `SEC-022` Auditer [client.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\client.ts)
- `SEC-023` Proposer une auth apprenant plus robuste
- `SEC-024` Implémenter le nouveau mécanisme

#### 2.3 Buckets et fichiers

- Lister tous les buckets publics.
- Confirmer ceux qui doivent l'être.
- Fermer les autres.

Tickets :

- `SEC-025` Inventorier les buckets et policies storage
- `SEC-026` Restreindre les buckets non publics

### Critères d'acceptation

- chaque accès public a une justification et une protection explicite
- le portail apprenant ne repose plus sur une simple confiance dans un header client
- les buckets publics sont minimaux et documentés

---

## Phase 3 - Nettoyage de la racine et de la documentation

### Objectif

Rendre le repo lisible en moins d'une minute.

### Priorité

`P1`

### Constat

La racine contient trop de documents concurrents ou temporaires :

- `README.md`
- `PRD.md`
- `plan.md`
- `PLAN-ELEARNING.md`
- `IMPROVEMENTS.md`
- `CLAUDE.md`
- `.lovable/plan.md`
- `.lovable/PRD-SuperTools.md`

### Actions

- Réécrire `README.md` avec :
  - vision du produit
  - stack
  - installation
  - conventions principales
  - lien vers `docs/`
- Déplacer les documents stratégiques dans `docs/`.
- Archiver ou supprimer les doublons `.lovable` s'ils ne sont plus utiles.
- Définir une convention documentaire :
  - `docs/product/`
  - `docs/architecture/`
  - `docs/operations/`
  - `docs/cleanup/`

### Tickets

- `DOC-001` Réécrire le README
- `DOC-002` Déplacer les docs racine dans `docs/`
- `DOC-003` Archiver les doublons `.lovable`
- `DOC-004` Définir la structure documentaire cible

### Critères d'acceptation

- la racine ne contient plus de documentation dispersée
- le README permet de démarrer sans connaissance préalable
- un nouvel arrivant comprend où trouver l'information fiable

---

## Phase 4 - Rationalisation de l'outillage

### Objectif

Éliminer les ambiguïtés d'environnement et de build.

### Priorité

`P1`

### Constat

Plusieurs lockfiles coexistent :

- `package-lock.json`
- `bun.lock`
- `bun.lockb`
- `deno.lock`

### Actions

- Choisir un gestionnaire unique pour le frontend.
- Garder `deno.lock` uniquement si le flux Edge Functions le nécessite réellement.
- Documenter officiellement la commande d'installation et de test.

### Tickets

- `OPS-001` Choisir l'outil package manager officiel
- `OPS-002` Supprimer les lockfiles non retenus
- `OPS-003` Documenter les commandes canoniques

### Critères d'acceptation

- une seule façon officielle d'installer le front
- plus de lockfiles redondants côté front
- documentation cohérente avec l'outillage réel

---

## Phase 5 - Contrat d'architecture frontend/backend

### Objectif

Réduire le couplage et rendre les refactors moins dangereux.

### Priorité

`P1`

### Constat

- trop d'accès directs à Supabase
- logique métier encore présente dans des composants UI
- coexistence de plusieurs styles d'accès aux données

### Règle cible

- `pages` : composition et routing
- `components` : rendu et interactions locales
- `hooks` : orchestration d'état et mutations
- `services` / `repositories` : accès backend et logique métier partageable
- `lib` : utilitaires purs

### Actions

- Interdire progressivement Supabase direct dans `src/components`.
- Déplacer les appels de données vers hooks/services.
- Écrire `docs/architecture.md` avec règles minimales.

### Tickets

- `ARCH-001` Définir le contrat d'architecture cible
- `ARCH-002` Interdire les nouveaux accès Supabase dans `src/components`
- `ARCH-003` Normaliser l'usage de `services/` et `hooks/`

### Critères d'acceptation

- les nouveaux développements suivent une structure stable
- la logique métier ne redescend plus dans les composants
- l'accès backend devient traçable

---

## Phase 6 - Refactor des zones monolithiques

### Objectif

Réduire les points de douleur les plus coûteux en maintenance.

### Priorité

`P2`

### Premier lot recommandé

- `BulkAddParticipantsDialog`
- `DailyTodoPanel`
- `useCrmBoard`
- `useEditParticipant`
- `ScheduledEmailsSummary`
- `MissionPages`
- `CardDetailDrawer`
- `Dashboard`
- `useLms`

### Stratégie

- refactor par tranches courtes
- tests ciblés avant ou pendant l'extraction
- pas de refactor géant multi-domaines en un seul lot

### Tickets

- `ARCH-010` Terminer les tickets déjà listés dans `docs/tickets/architecture-violations.md`
- `ARCH-011` Lister les 20 plus gros fichiers et créer un plan de découpage
- `ARCH-012` Ajouter des tests sur les modules extraits

### Critères d'acceptation

- baisse du nombre de gros fichiers
- moins de hooks "god objects"
- composants UI plus simples à relire et à tester

---

## Phase 7 - Qualité continue et anti-régression

### Objectif

Empêcher le retour à l'état actuel.

### Priorité

`P1`

### Actions

- Étendre `scripts/check-rules.sh`.
- Ajouter des checks sur :
  - nouveaux composants > 300 lignes
  - nouveaux hooks > 250 lignes
  - nouveaux accès Supabase dans `src/components`
  - nouvelles functions `verify_jwt = false`
  - nouveaux `USING (true)` sur des données sensibles
- Ajouter une baseline métrique versionnée.

### Tickets

- `QAL-001` Étendre les checks structurels
- `QAL-002` Ajouter des checks sécurité simples
- `QAL-003` Ajouter une baseline de métriques

### Critères d'acceptation

- les nouvelles dérives sont détectées tôt
- les règles sont exécutables, pas seulement documentées
- le repo devient plus stable à chaque intervention

---

## Ordre d'exécution recommandé

1. `Phase 0`
2. `Phase 1`
3. `Phase 2`
4. `Phase 3`
5. `Phase 4`
6. `Phase 5`
7. `Phase 7`
8. `Phase 6`

Note :
La phase 6 vient après les garde-fous, sinon on risque de refactorer sans filet.

---

## Backlog priorisé

### P0

- `SEC-001` Restreindre CORS
- `SEC-003` Cartographier les functions publiques
- `SEC-006` Auditer `agent-chat`
- `SEC-010` Corriger la RLS de `document_embeddings`
- `SEC-013` Auditer `agent_sql_query`
- `SEC-020` Auditer les parcours publics
- `SEC-022` Auditer le portail apprenant

### P1

- `DOC-001` Réécrire le README
- `DOC-002` Déplacer la doc racine
- `OPS-001` Choisir le package manager officiel
- `ARCH-001` Définir le contrat d'architecture
- `QAL-001` Étendre les checks

### P2

- `ARCH-010` Refactor des zones monolithiques
- `ARCH-011` Plan de découpage des gros fichiers
- `ARCH-012` Renforcer les tests pendant refactor

---

## Définition de terminé

Le chantier de nettoyage pourra être considéré comme correctement engagé quand :

- les surfaces publiques sont réduites et documentées
- la couche agent/RAG n'expose plus de données trop largement
- la racine du repo est claire
- l'outillage est unifié
- les règles d'architecture sont écrites et appliquées
- les plus gros points de douleur ont un plan de découpage
- des checks automatiques empêchent de retomber dans le même état

