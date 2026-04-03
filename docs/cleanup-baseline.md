# Cleanup Baseline

> Baseline d'audit du repo `super-tools`
> Référence observée sur `main` GitHub le 2026-04-03

## Objectif

Ce document capture l'état réel du repo avant remise à plat.

Il sert à :

- rendre la dette visible
- éviter les impressions vagues
- donner une base commune à des mainteneurs ou contributeurs externes
- mesurer les progrès du chantier de nettoyage

Ce document complète :

- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)
- [README.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\README.md)
- [PRD.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\PRD.md)
- [docs/architecture.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\architecture.md)
- [SECURITY.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\SECURITY.md)

---

## 1. Résumé rapide

Le projet est riche, réel, et déjà exploitable sur de nombreux flux métier.

Mais il présente encore plusieurs signes forts de dette :

- largeur fonctionnelle élevée
- documentation historiquement dispersée
- couplage fort entre UI et backend
- beaucoup de surfaces Supabase exposées
- plusieurs composants et hooks trop gros
- modèle de sécurité encore à durcir

Conclusion pratique :

- le produit est crédible en open source
- le repo n'est pas encore "self-explanatory" sans effort documentaire
- la documentation posée récemment améliore nettement la situation
- le chantier technique reste nécessaire pour qu'une contribution externe soit sereine

---

## 2. Chiffres de référence

À date d'audit :

- `126` Edge Functions
- `303` migrations SQL
- `65` pages React
- `68` routes déclarées
- `35` fichiers de tests
- `77` composants contenant des accès directs `supabase.`
- `38` hooks contenant des accès directs `supabase.`
- `225` fichiers important le client Supabase
- `121` occurrences de `verify_jwt = false` dans `supabase/config.toml`

Lecture recommandée de ces chiffres :

- la richesse fonctionnelle est réelle
- la surface de maintenance est importante
- les couches ne sont pas encore assez découplées
- le chantier sécurité n'est pas marginal, il est central

---

## 3. État documentaire

### Positif

Le socle de documentation a été récemment renforcé avec :

- [README.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\README.md)
- [PRD.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\PRD.md)
- [CONTRIBUTING.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\CONTRIBUTING.md)
- [SECURITY.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\SECURITY.md)
- [docs/architecture.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\architecture.md)
- [docs/cleanup-plan.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\docs\cleanup-plan.md)

### Dette restante

La racine contient encore des documents qui se chevauchent :

- `plan.md`
- `PLAN-ELEARNING.md`
- `IMPROVEMENTS.md`
- `CLAUDE.md`

La zone `.lovable` contient encore :

- `.lovable/plan.md`
- `.lovable/PRD-SuperTools.md`

Ces fichiers ne sont pas forcément inutiles, mais ils contribuent encore à une lecture confuse pour un contributeur externe.

---

## 4. Dette d'architecture observée

## 4.1 Couplage frontend <-> Supabase

Le frontend utilise Supabase de manière très diffuse.

Indicateurs :

- `77` composants avec accès direct `supabase.`
- `38` hooks avec accès direct `supabase.`
- `225` fichiers qui importent le client Supabase

Conséquences :

- refactors plus risqués
- impacts de schéma difficiles à anticiper
- responsabilité des couches moins lisible

## 4.2 Grosseur de fichiers

Les plus gros fichiers observés hors génération de types :

- [ScheduledEmailsSummary.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\formations\ScheduledEmailsSummary.tsx) : `937` lignes
- [settingsConstants.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\settings\settingsConstants.ts) : `917` lignes
- [useArenaDiscussion.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\hooks\useArenaDiscussion.ts) : `916` lignes
- [MissionPages.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\missions\MissionPages.tsx) : `891` lignes
- [CommentThread.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\content\CommentThread.tsx) : `873` lignes
- [CatalogFormDialog.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\catalogue\CatalogFormDialog.tsx) : `839` lignes
- [Step3QuoteGeneration.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\quotes\Step3QuoteGeneration.tsx) : `836` lignes
- [TrainingSummary.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\pages\TrainingSummary.tsx) : `798` lignes
- [CardDetailDrawer.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\crm\CardDetailDrawer.tsx) : `763` lignes
- [KanbanBoard.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\components\content\KanbanBoard.tsx) : `741` lignes
- [Dashboard.tsx](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\pages\Dashboard.tsx) : `724` lignes
- [useLms.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\hooks\useLms.ts) : `706` lignes

Ces fichiers ne sont pas forcément “mauvais”, mais ils augmentent le coût d'entrée pour un externe.

## 4.3 Hétérogénéité structurelle

Le repo contient déjà de bons patterns, mais ils coexistent avec des patterns plus anciens ou plus directs.

En pratique :

- certaines zones suivent bien `page -> hook -> service`
- d'autres restent plus “page/composant -> supabase direct”

Cela rend la contribution moins prédictible.

---

## 5. Dette sécurité observée

## 5.1 Edge Functions publiques

`121` entrées `verify_jwt = false` sont présentes dans [supabase/config.toml](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\config.toml).

Cela impose une revue fine de :

- ce qui est vraiment public
- ce qui devrait être protégé
- ce qui relève d'un webhook signé
- ce qui est une dette historique

## 5.2 CORS

La configuration centralisée actuelle utilise encore `Access-Control-Allow-Origin: "*"`.

Référence :

- [cors.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\supabase\functions\_shared\cors.ts)

## 5.3 Portail apprenant

Le client apprenant repose actuellement sur le header `x-learner-email`.

Référence :

- [client.ts](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\src\integrations\supabase\client.ts)

Ce mécanisme existe, mais il doit être traité comme une zone de durcissement.

## 5.4 Agent IA et indexation

La récente couche agent / RAG est stratégique mais sensible.

Zones à surveiller :

- `agent-chat`
- `index-documents`
- `process-indexation-queue`
- `document_embeddings`
- RPC et lectures transverses

Pour l'open source, c'est une zone qui doit être documentée et auditée, pas seulement "fonctionnelle".

---

## 6. Dette qualité et tests

Le repo dispose déjà d'une base de tests et de garde-fous, mais elle reste insuffisante à l'échelle du produit.

Points positifs :

- présence de tests unitaires
- présence de [scripts/check-rules.sh](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\scripts\check-rules.sh)
- présence d'invariants documentés dans [IMPROVEMENTS.md](C:\Users\coutu\SuperTilt Dropbox\Romain Couturier\Codex\super-tools\IMPROVEMENTS.md)

Limites :

- `35` fichiers de tests pour un produit très large
- couverture hétérogène selon les modules
- garde-fous encore incomplets sur les couches structurelles et sécurité

---

## 7. Points positifs du repo

Ce baseline ne sert pas seulement à lister les problèmes. Le repo a aussi plusieurs forces nettes.

### 7.1 Produit réel

Ce n'est pas un prototype.

Le produit couvre déjà :

- un noyau formation très dense
- un vrai CRM
- des devis
- des missions
- du LMS
- de la veille
- un agent
- du monitoring

### 7.2 Patterns déjà solides

On trouve déjà :

- de bons hooks métier
- des services réutilisables
- un routeur riche mais cohérent
- une vraie culture d'amélioration continue via `IMPROVEMENTS.md`
- une volonté visible de capitaliser les leçons apprises

### 7.3 Documentation désormais suffisante pour contribuer

Avec les docs récemment ajoutées, un externe peut désormais :

- comprendre le produit
- comprendre le repo
- comprendre comment contribuer
- comprendre où se situent les risques

Ce n'était pas encore le cas auparavant.

---

## 8. Priorités de nettoyage découlant de cette baseline

### Priorité 1

- durcissement sécurité
- clarification des surfaces publiques
- revue agent / RAG

### Priorité 2

- clarification documentaire restante
- nettoyage de la racine
- rationalisation de l'outillage

### Priorité 3

- réduction du couplage frontend <-> Supabase
- découpage des gros composants et hooks

### Priorité 4

- renforcement progressif des tests
- extension des checks automatiques

---

## 9. Définition de progrès mesurable

Le nettoyage progresse si, à terme :

- le nombre de surfaces publiques injustifiées baisse
- le nombre d'accès Supabase directs dans `src/components` baisse
- les plus gros fichiers sont découpés
- la racine devient lisible sans contexte historique
- les docs de contribution restent à jour
- les nouveaux changements respectent les garde-fous

---

## 10. Conclusion

Le repo `super-tools` est déjà suffisamment riche pour être intéressant en open source.

Mais pour devenir vraiment contributable par un développeur externe ou un agent externe, il doit être lu comme :

- un produit réel
- un repo encore en cours de clarification
- un projet honnête sur ses limites

Cette baseline sert précisément à éviter l'écart entre ces trois réalités.

