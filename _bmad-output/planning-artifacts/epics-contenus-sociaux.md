---
stepsCompleted: [1, 2]
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

FR1 : Epic 1 - Calendrier semaine et mois avec aperçu
FR2 : Epic 1 - Colonne Non planifiés et glisser-déposer
FR3 : Epic 1 - Filtre global par canal
FR4 : Epic 1 - Composeur multi-canaux
FR5 : Epic 1 - Groupe de posts et texte synchronisé
FR6 : Epic 1 - Sauvegarde continue du brouillon
FR7 : Epic 2 - Axe validation (l'axe publication arrive dès l'Epic 1)
FR8 : Epic 1 (Brouillon, Programmé, Publié) puis Epic 2 (échelle complète)
FR9 : Epic 1 - Marquer comme publié
FR10 : Epic 2 - Demande de validation et action quotidienne
FR11 : Epic 2 - Approbation par groupe, retrait
FR12 : Epic 2 - Refus avec motif
FR13 : Epic 2 - Retour en attente si le fond change
FR14 : Epic 2 - Tableau Mes validations
FR15 : Epic 2 - Commentaires internes, mentions, résolution
FR16 : Epic 2 - Historique avec version précédente
FR17 : Epic 3 - Fiche campagne
FR18 : Epic 3 - Bandeau, calendrier de campagne, rattachement
FR19 : Epic 1 - Visuels depuis la Médiathèque
FR20 : Epic 1 - Notes de calendrier
FR21 : Epic 4 - Contexte de marque
FR22 : Epic 1 - Thèmes éditoriaux
FR23 : Epic 3 - Vues liste et aperçu
FR24 : Epic 3 - Filtres combinés et vues enregistrées
FR25 : Epic 5 - Migration des cartes post
FR26 : Epic 5 - Lien post et carte éditoriale
FR27 : Epic 4 - MCP lecture
FR28 : Epic 4 - MCP brouillon groupé daté
FR29 : Epic 4 - MCP validation et commentaires
FR30 : Epic 3 - Grille Instagram
FR31 : Epic 1 - Alertes visuel et longueur
FR32 : Epic 1 - Canaux de départ

## Epic List

### Epic 1 : Planifier et rédiger tous les contenus dans un calendrier
Romain et Emmanuelle rédigent un contenu une fois, le déclinent sur plusieurs canaux avec un visuel de la Médiathèque, le classent par thème et le planifient dans le calendrier mensuel de la maquette. Le module est utilisable au quotidien sans validation.
**FRs couverts :** FR1, FR2, FR3, FR4, FR5, FR6, FR8 (partiel), FR9, FR19, FR20, FR22, FR31, FR32

### Epic 2 : Faire valider les contenus
Un auteur demande une validation, l'autre personne la reçoit en action quotidienne et approuve, refuse avec motif ou corrige depuis Mes validations ; tout changement de fond est tracé et remet en attente.
**FRs couverts :** FR7, FR8, FR10, FR11, FR12, FR13, FR14, FR15, FR16

### Epic 3 : Piloter par campagnes et par vues
Les posts se regroupent en campagnes avec brief, bandeau et calendrier propre ; on les pilote en liste, en aperçu et en grille Instagram, avec filtres combinés et vues enregistrées.
**FRs couverts :** FR17, FR18, FR23, FR24, FR30

### Epic 4 : Rédiger et valider avec Claude via le MCP
Claude lit le contexte de marque, consulte le calendrier, propose des brouillons datés multi-canaux, valide ou refuse et commente, toujours dans le circuit de validation.
**FRs couverts :** FR21, FR27, FR28, FR29

### Epic 5 : Sortir les posts du kanban newsletter
Les 6 cartes post deviennent des posts, et un post peut décliner une carte éditoriale avec un lien dans les deux sens.
**FRs couverts :** FR25, FR26

## Epic 1 : Planifier et rédiger tous les contenus dans un calendrier

Romain et Emmanuelle rédigent un contenu une fois, le déclinent sur plusieurs canaux avec un visuel de la Médiathèque, le classent par thème et le planifient dans le calendrier mensuel de la maquette. Le module est utilisable au quotidien sans validation.

### Story 1.1 : Rédiger un contenu décliné sur plusieurs canaux

En tant que membre de l'équipe ayant le droit supertilt.fr,
je veux rédiger un contenu une fois et le décliner sur plusieurs canaux,
afin de préparer mes publications sans les ressaisir pour chaque réseau.

**Acceptance Criteria:**

**Given** un utilisateur avec le droit `supertilt_fr`
**When** il ouvre le menu supertilt.fr
**Then** un sous-module « Contenus sociaux » (`/supertilt-fr/contenus-sociaux`) apparaît, sans droit supplémentaire
**And** un utilisateur sans ce droit ne voit ni le sous-module ni les données (RLS sur chaque nouvelle table via `has_module_access`)

**Given** la migration de la story
**When** elle est jouée
**Then** les 8 canaux de départ existent : LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram, YouTube, Facebook, Blog, Le Déclic, chacun avec un nom, une abréviation (LI, IN, YO, FA…) et une limite de texte facultative
**And** la liste des canaux est extensible sans modification de code
**And** les nouvelles tables sont ajoutées aux listes de sauvegarde (`scheduled-backup`, `backup-export`)

**Given** le composeur ouvert
**When** l'auteur coche trois canaux, choisit un format (post, story, reel), saisit un texte et ne pose pas de date
**Then** l'enregistrement crée trois posts liés par un groupe, statut de publication « sans date »
**And** tant que la synchro est active, modifier le texte met à jour les trois posts ; la couper rend chaque déclinaison indépendante

**Given** un brouillon en cours de rédaction
**When** l'auteur ferme le composeur sans enregistrer puis le rouvre
**Then** son brouillon est retrouvé sans perte (sauvegarde continue par `useAutoSaveForm`)

**Given** des brouillons sans date
**When** l'utilisateur ouvre le module
**Then** la colonne « Non planifiés · N » liste ces brouillons avec leurs badges canaux (UX-DR3)

### Story 1.2 : Planifier dans le calendrier avec aperçu des contenus

En tant que membre de l'équipe,
je veux voir tous les contenus dans un calendrier mensuel et hebdomadaire et y glisser mes brouillons,
afin de planifier les publications de tous les canaux d'un seul coup d'œil.

**Acceptance Criteria:**

**Given** des posts datés
**When** l'utilisateur ouvre l'onglet Calendrier en vue mois
**Then** la grille va du lundi au dimanche, met en évidence le jour courant et grise les jours hors mois (UX-DR4)
**And** chaque jour montre ses contenus en cartes : pastille de statut, heure, badges canaux, début du titre tronqué (UX-DR5), dans l'ordre horaire
**And** une vue semaine affiche les mêmes cartes sur sept jours

**Given** un brouillon dans « Non planifiés »
**When** l'utilisateur le glisse sur un jour
**Then** la date est posée sur toutes les déclinaisons du groupe, le statut affiché passe à « Programmé » et le brouillon quitte la colonne

**Given** un post daté
**When** l'utilisateur le glisse sur un autre jour
**Then** seule la date change, l'heure est conservée

**Given** la barre des canaux
**When** l'utilisateur décoche un canal
**Then** ses posts disparaissent de la grille et de la colonne « Non planifiés »

**Given** l'en-tête du calendrier
**When** il s'affiche
**Then** les onglets Calendrier, Liste, Aperçus, MCP sont présents (seul Calendrier est actif dans cet epic) (UX-DR1)
**And** la légende montre les statuts affichés Brouillon, Programmé, Publié avec leur couleur (UX-DR7)
**And** l'écran passe le mode démo (`demoMask`) et le contrôle [065]

### Story 1.3 : Joindre un visuel de la Médiathèque et être alerté d'un post incomplet

En tant qu'auteur,
je veux choisir le visuel de chaque contenu dans la Médiathèque et voir quand un post est incomplet pour son réseau,
afin de ne jamais publier sans visuel ni avec un texte trop long.

**Acceptance Criteria:**

**Given** le composeur
**When** l'auteur ajoute un visuel
**Then** il le choisit dans la Médiathèque existante, sans import vers un nouveau stockage
**And** le visuel est partagé par les déclinaisons tant que la synchro est active

**Given** un post sans visuel
**When** il s'affiche en carte, dans la colonne Non planifiés ou dans le composeur
**Then** une alerte « visuel manquant » est visible sans ouvrir le post (UX-DR8)

**Given** un post dont le texte dépasse la limite de son canal
**When** il s'affiche
**Then** une alerte « texte trop long » indique la limite et le dépassement
**And** l'alerte disparaît dès que le post est corrigé
**And** aucune alerte n'empêche l'enregistrement, la planification ni le marquage publié

**Given** la règle d'alerte
**When** elle est calculée
**Then** elle l'est par une fonction pure partagée, testée unitairement, réutilisable par le MCP (Epic 4)

### Story 1.4 : Classer les contenus par thèmes et filtrer

En tant que membre de l'équipe,
je veux créer des thèmes éditoriaux colorés, les attribuer aux contenus et filtrer le calendrier,
afin de voir l'équilibre de la ligne éditoriale.

**Acceptance Criteria:**

**Given** le module installé
**When** l'utilisateur ouvre les réglages des thèmes
**Then** la liste est vide au départ ; il peut créer, renommer et recolorer un thème

**Given** un thème attribué à un contenu dans le composeur
**When** la carte s'affiche dans le calendrier
**Then** son liseré gauche prend la couleur du thème (UX-DR5)

**Given** la barre de filtres
**When** l'utilisateur sélectionne des pastilles de thème, de réseau et de statut
**Then** le calendrier et la colonne Non planifiés n'affichent que les contenus qui correspondent (UX-DR2, sans vues enregistrées)
**And** désélectionner toutes les pastilles d'une famille revient à ne pas filtrer sur cette famille

### Story 1.5 : Ouvrir un contenu, le modifier et le marquer publié

En tant qu'auteur,
je veux ouvrir le détail d'un contenu, le modifier et le marquer publié quand je l'ai posté sur le réseau,
afin que le calendrier reflète ce qui est réellement sorti.

**Acceptance Criteria:**

**Given** une carte du calendrier
**When** l'utilisateur clique dessus
**Then** le détail s'ouvre avec texte, visuel, canaux, thème, format, date et heure, modifiables

**Given** un post programmé
**When** l'utilisateur le marque publié
**Then** son statut de publication devient « marqué comme publié », le statut affiché « Publié »
**And** le post reste modifiable ; un second geste annule le marquage
**And** le marquage s'applique à la déclinaison concernée, pas à tout le groupe

**Given** un contenu devenu inutile
**When** l'utilisateur le supprime
**Then** une confirmation (`useConfirm()`) est demandée et seule la déclinaison choisie, ou tout le groupe sur demande, est supprimée

### Story 1.6 : Poser des notes dans le calendrier

En tant que membre de l'équipe,
je veux poser une note datée sur un jour du calendrier,
afin de garder un repère (lancement, relance, idée) à côté des publications.

**Acceptance Criteria:**

**Given** un jour du calendrier
**When** l'utilisateur ajoute une note avec un texte et une couleur
**Then** la note s'affiche sur ce jour, distincte des cartes de contenu
**And** elle n'entre dans aucun statut, filtre de statut ni compteur de posts

**Given** une note existante
**When** l'utilisateur la modifie, la déplace sur un autre jour ou la supprime
**Then** le calendrier se met à jour
