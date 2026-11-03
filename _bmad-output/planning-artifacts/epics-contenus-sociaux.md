---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/specs/spec-contenus-sociaux/SPEC.md
  - _bmad-output/specs/spec-contenus-sociaux/maquette-calendrier.md
  - _bmad-output/specs/spec-contenus-sociaux/statuts-et-validation.md
  - _bmad-output/specs/spec-contenus-sociaux/reference-planable.md
  - _bmad-output/specs/spec-contenus-sociaux/brownfield.md
  - _bmad-output/planning-artifacts/architecture/architecture-super-tools-2026-09-24/ARCHITECTURE-SPINE.md
  - docs/architecture.md
---

# super-tools - Découpage en epics : Contenus sociaux

## Overview

Ce document découpe en epics et en stories implémentables le module Contenus sociaux, intégré au module supertilt.fr. Il s'appuie sur la spec `spec-contenus-sociaux`, la maquette du calendrier et l'architecture de super-tools.

## Requirements Inventory

### Functional Requirements

FR1 : Un calendrier, en vue semaine et en vue mois, affiche tous les posts et contenus de tous les canaux. Chaque jour montre un aperçu de ses contenus : heure, statut, canaux, couleur du thème, début du titre (CAP-1).
FR2 : Une colonne « Non planifiés » liste les brouillons sans date avec leur nombre. Glisser un brouillon sur un jour pose la date sur toutes ses déclinaisons (CAP-1).
FR3 : Une barre de canaux filtre tous les écrans. Décocher un canal le retire partout (CAP-1).
FR4 : Un composeur crée un contenu une fois et le décline sur plusieurs canaux. Il propose le format (post, story, reel), le thème, la campagne et une date facultative (CAP-2).
FR5 : Un contenu décliné forme un groupe, avec un post par canal. Tant que la synchro est active, une modification du texte s'applique à tout le groupe. La couper rend chaque déclinaison indépendante (CAP-2).
FR6 : Le brouillon est sauvegardé en continu. Le rouvrir le retrouve sans perte (CAP-2).
FR7 : Chaque post stocke deux axes indépendants. Validation : non demandée, en attente, approuvé, refusé. Publication : sans date, programmé, marqué comme publié (CAP-3).
FR8 : L'écran affiche une seule échelle (Brouillon, En validation, Approuvé, Programmé, Publié), calculée à partir des deux axes selon la correspondance de `statuts-et-validation.md`. Un post refusé s'affiche « Brouillon », avec son motif (CAP-3).
FR9 : Un post peut être marqué publié à la main. Il garde son approbation et reste modifiable (CAP-3).
FR10 : Un auteur demande une validation. Une action quotidienne est alors créée pour l'autre approbateur (CAP-4).
FR11 : Romain ou Emmanuelle approuve un post, y compris le sien. L'approbation vaut pour tout le groupe. Elle se retire d'un second clic, ce qui ramène le post à « non demandée » (CAP-4).
FR12 : Un refus exige un motif. Le post passe en « refusé » et l'auteur est prévenu (CAP-4).
FR13 : Modifier le texte ou un visuel d'un post approuvé ou refusé le remet en attente. Changer seulement sa date conserve l'approbation (CAP-4).
FR14 : Un tableau « Mes validations » montre trois colonnes : à valider, retour laissé, validé. Un mode revue enchaîne les posts un par un. Le menu affiche le nombre de validations en attente de l'utilisateur connecté (CAP-5).
FR15 : Un post porte des commentaires internes, avec mentions, que l'on peut résoudre. L'approbateur corrige directement le texte, sans mode proposition (CAP-6).
FR16 : L'historique d'un post liste chaque action, datée et attribuée. Il garde la version précédente pour un changement de texte ou de date (CAP-6).
FR17 : Une campagne a un nom, une icône, une couleur, un statut (préparation, active, terminée), des dates facultatives, des liens et un brief en texte riche (CAP-7).
FR18 : Une campagne s'affiche en bandeau sur les jours qu'elle couvre et a son propre calendrier. Un post créé depuis la campagne y est rattaché. Un post a au plus une campagne (CAP-7).
FR19 : Les visuels des posts et des campagnes se choisissent dans la Médiathèque existante (CAP-7, contrainte).
FR20 : Une note de calendrier a un jour, un texte et une couleur. Elle n'a aucun statut de post (CAP-8).
FR21 : Un contexte de marque (description, offres, ton, valeurs, terminologie, audience) se modifie dans le module et se lit par le MCP (CAP-9).
FR22 : Des thèmes éditoriaux se créent et se renomment. La liste démarre vide. Chaque thème a une couleur, qui sert de liseré sur la carte, et sert de filtre (CAP-10).
FR23 : Une vue liste et une vue aperçu (rendu réseau) affichent les posts (CAP-11).
FR24 : Les filtres se combinent : validation, publication, campagne, thème, période, canal, auteur, recherche plein texte. Une vue enregistrée rappelle une combinaison de filtres (CAP-11, maquette).
FR25 : Les 6 cartes `content_cards` de type `post` ou `post_linkedin` deviennent des posts, avec leur texte et leur date, et quittent le kanban newsletter (CAP-12).
FR26 : Un post se rattache à une carte du kanban éditorial, et le lien se suit dans les deux sens (CAP-12).
FR27 : Le MCP liste les posts par statut de validation, de publication et par période. Il lit un post avec ses commentaires, son historique et ses alertes (CAP-13).
FR28 : Le MCP crée un brouillon groupé multi-canaux avec une date proposée. Le brouillon part non validé (CAP-13).
FR29 : Le MCP approuve, ou refuse avec un motif. Il lit et ajoute des commentaires (CAP-13).
FR30 : Une vue grille montre les posts Instagram publiés et à venir, comme sur le profil, trois par ligne, dans l'ordre de publication (CAP-14).
FR31 : Une alerte signale un post sans visuel, ou dont le texte dépasse la limite de son réseau. Elle est visible sur la carte, en liste et dans le détail, et disparaît une fois le post corrigé. Elle ne bloque ni la validation ni le marquage comme publié (CAP-15).
FR32 : Les canaux de départ sont LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram, YouTube, Facebook, Blog et Le Déclic. La liste est extensible (contrainte).

### NonFunctional Requirements

NFR1 : Tout le module vit dans le groupe supertilt.fr, en sous-modules. Le droit d'accès est `supertilt_fr`, sans droit par sous-module.
NFR2 : Aucune publication native vers les réseaux : le statut publié se marque à la main.
NFR3 : Un seul espace (SuperTilt). Aucun portail ni visibilité client.
NFR4 : Validation à un seul niveau ; approbateurs : Romain ou Emmanuelle.
NFR5 : Aucune IA de rédaction dans le composeur. La rédaction assistée passe uniquement par Claude via le MCP.
NFR6 : Toute publication porte un visuel, quel que soit son canal.
NFR7 : Le MCP n'a que les droits de l'utilisateur connecté et ne contourne jamais le circuit de validation.
NFR8 : Les écrans internes passent le mode démo. Les données identifiantes sont masquées par `src/lib/demoMask.ts` (règle [065]).

### Additional Requirements

- AD-1 : RLS active sur chaque nouvelle table. Les policies passent par `has_module_access(uid, 'supertilt_fr')` ou `is_admin`, jamais par une logique recopiée. Une règle d'accès nouvelle est une fonction SQL testée sur un vrai Postgres.
- AD-5 : le front accède aux données par `src/hooks/` (TanStack Query), avec délégation à `src/services/`. Aucun accès Supabase dans les pages ou composants. Les erreurs passent par `toastError()` et `reportHandledError()`.
- AD-8 : le schéma n'évolue que par une migration rejouable de `supabase/migrations/`. La migration de production est un geste explicite. `types.ts` est régénéré, jamais édité à la main.
- AD-9 : toute nouvelle table est ajoutée aux listes de `scheduled-backup` et `backup-export`, ou à `scripts/backup-exclusions.txt`.
- AD-11 : une entité à effets de bord a un propriétaire unique. Les transitions du circuit de validation (approbation, refus, remise en attente, action quotidienne) sont portées par une fonction SQL `SECURITY DEFINER`, que l'écran comme le MCP appellent. Aucun point d'entrée n'écrit le statut en direct.
- AD-4 / MCP : les outils s'ajoutent au serveur existant (`supabase/functions/mcp-server/index.ts`), avec la garde MCP en place (OAuth ou clé API). Aucun second serveur.
- Notification : la demande de validation passe par le mécanisme `daily_actions` existant (`generate-daily-actions` ou une insertion directe dans la même table).
- Annuaire : la liste des approbateurs et les mentions passent par la RPC `get_staff_directory`, jamais par `profiles` en direct (règle [076]).
- Auto-sauvegarde par `useAutoSaveForm` (règle [001]). Spinners par `<Spinner />`, confirmations par `useConfirm()`.
- Migration des 6 cartes post : script idempotent, joué une fois en production après la publication du front.
- `check-rules.sh` passe avant chaque commit. Textes UI, documentation et commits en français.

### UX Design Requirements

UX-DR1 : En-tête du module avec quatre onglets : Calendrier, Liste, Aperçus, MCP (maquette).
UX-DR2 : Barre de filtres en pastilles : thème (avec la couleur du thème), réseau, statut. Une liste déroulante « Vue enregistrée » rappelle une combinaison sauvegardée.
UX-DR3 : Colonne gauche « Non planifiés · N » : cartes d'idées et de brouillons sans date, glissables sur un jour.
UX-DR4 : Grille mensuelle du lundi au dimanche. Le jour courant est mis en évidence et les jours hors mois sont grisés.
UX-DR5 : Carte de contenu : pastille de statut, heure, badges canaux abrégés (LI, IN, FA, YO, puis Blog et Déclic), liseré gauche à la couleur du thème, début du titre tronqué.
UX-DR6 : Bandeau de campagne avec un chevron et un nom tronqué, au-dessus des cartes, sur chaque jour couvert.
UX-DR7 : Légende des statuts en haut à droite du calendrier, une couleur par statut affiché.
UX-DR8 : Indicateur d'alerte sur une carte incomplète (visuel absent, texte trop long), lisible sans ouvrir le post.
UX-DR9 : Vue grille Instagram en carrés, trois par ligne.

### FR Coverage Map

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
