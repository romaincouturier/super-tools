---
stepsCompleted: [1, 2, 3, 4]
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

**Critères communs à toutes les stories** (non répétés dans chacune) :
- chaque nouvelle table a la RLS `supertilt_fr` et figure dans les listes de sauvegarde (AD-1, AD-9) ;
- l'accès aux données passe par `src/hooks/` et `src/services/`, jamais depuis une page ou un composant (AD-5) ;
- chaque écran interne passe le mode démo (`demoMask`, contrôle [065]) ;
- `npm run typecheck`, `bash scripts/check-rules.sh` et `npm test` passent ; textes UI en français ;
- une migration de `supabase/migrations/` est jouée explicitement en production ; un changement de `supabase/` explicite son impact sécurité dans la PR.

**Choix de structure** : les epics 1, 2 et 3 touchent les mêmes écrans (calendrier, composeur, détail). La séparation est gardée volontairement : l'epic 1 livre un module utilisable seul, et le circuit de validation (epic 2) est la zone de risque sur laquelle un retour d'usage peut changer la suite.

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
FR27 : Le MCP liste les posts par statut de validation, de publication et par période, avec les validations en attente classées par urgence de date de sortie. Il lit un post avec ses commentaires, son historique et ses alertes (CAP-13).
FR28 : Le MCP crée un brouillon groupé multi-canaux avec une date proposée. Le brouillon part non validé (CAP-13).
FR29 : Le MCP approuve, ou refuse avec un motif, et programme un contenu (pose ou déplace sa date, approbation conservée). Il lit et ajoute des commentaires (CAP-13).
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

UX-DR1 : En-tête du module avec trois onglets : Calendrier, Liste, Aperçus. L'onglet MCP de la maquette illustrait le MCP de Planable et n'est pas repris.
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

**Exigences :** FR4, FR5, FR6, FR32 ; UX-DR3

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

**Exigences :** FR1, FR2, FR3, FR8 (partiel) ; UX-DR1, UX-DR4, UX-DR5, UX-DR7

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
**Then** les onglets Calendrier, Liste, Aperçus sont présents (seul Calendrier est actif dans cet epic) (UX-DR1)
**And** la légende montre les statuts affichés Brouillon, Programmé, Publié avec leur couleur (UX-DR7)
**And** l'écran passe le mode démo (`demoMask`) et le contrôle [065]

### Story 1.3 : Joindre un visuel de la Médiathèque et être alerté d'un post incomplet

**Exigences :** FR19, FR31 ; UX-DR8

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

**Exigences :** FR22, FR24 (partiel) ; UX-DR2, UX-DR5

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

**Exigences :** FR9

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

**Exigences :** FR20

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

## Epic 2 : Faire valider les contenus

Un auteur demande une validation, l'autre personne la reçoit en action quotidienne et approuve, refuse avec motif ou corrige depuis Mes validations ; tout changement de fond est tracé et remet en attente.

### Story 2.1 : Demander une validation et approuver un contenu

**Exigences :** FR7, FR8, FR10, FR11

En tant qu'auteur puis approbateur,
je veux demander la validation d'un contenu et l'approuver d'un clic,
afin qu'aucun contenu ne parte sans un second regard, comme dans Planable.

**Acceptance Criteria:**

**Given** la migration de la story
**When** elle est jouée
**Then** chaque post porte un axe validation (non demandée, en attente, approuvé, refusé) indépendant de l'axe publication
**And** toutes les transitions de validation passent par une seule fonction SQL `SECURITY DEFINER`, testée sur un vrai Postgres ; aucun écran n'écrit le statut en direct (AD-11)

**Given** un contenu en brouillon
**When** l'auteur clique « Demander une validation »
**Then** tout le groupe passe « en attente » et le statut affiché devient « En validation »

**Given** un contenu en attente
**When** Romain ou Emmanuelle, auteur compris, clique la coche d'approbation
**Then** tout le groupe passe « approuvé » ; l'approbateur et la date sont enregistrés et affichés « Approuvé par … » (l'historique complet arrive en story 2.3)
**And** un second clic retire l'approbation et ramène le groupe à « non demandée »

**Given** les deux axes
**When** le statut affiché est calculé
**Then** l'échelle complète s'applique, première condition vraie : Publié, Programmé (approuvé et daté), Approuvé, En validation, Brouillon (`statuts-et-validation.md`)
**And** la légende du calendrier affiche les cinq statuts

**Given** des contenus en attente
**When** `generate-daily-actions` s'exécute
**Then** une action quotidienne « Contenu à valider », avec lien vers le contenu, est créée pour l'autre approbateur que l'auteur
**And** l'action disparaît à la génération suivante dès que le contenu n'est plus en attente
**And** la liste des approbateurs passe par la RPC `get_staff_directory` (règle [076])

### Story 2.2 : Refuser un contenu avec motif

**Exigences :** FR12

En tant qu'approbateur,
je veux refuser un contenu en donnant un motif obligatoire,
afin que l'auteur sache exactement quoi corriger.

**Acceptance Criteria:**

**Given** un contenu en attente
**When** l'approbateur clique « Refuser » sans saisir de motif
**Then** le refus est impossible

**Given** un motif saisi
**When** l'approbateur confirme le refus
**Then** tout le groupe passe « refusé », le statut affiché est « Brouillon » et le motif est visible sur la carte et dans le détail
**And** une action quotidienne « Contenu refusé » est créée pour l'auteur, avec le motif

### Story 2.3 : Remettre en attente un contenu modifié et tracer son historique

**Exigences :** FR13, FR15 (correction directe), FR16

En tant qu'approbateur,
je veux qu'un contenu validé dont le texte ou le visuel change revienne en validation, et voir tout son historique,
afin qu'aucun texte validé ne change sans revalidation.

**Acceptance Criteria:**

**Given** un contenu approuvé ou refusé
**When** quelqu'un modifie le texte ou le visuel d'une déclinaison
**Then** le groupe repasse « en attente » et redevient « à valider » pour l'autre approbateur

**Given** un contenu approuvé
**When** seule sa date ou son heure change, par glisser-déposer ou dans le détail
**Then** l'approbation est conservée

**Given** un approbateur qui corrige directement le texte (pas de mode proposition)
**When** il enregistre
**Then** la correction suit la même règle de remise en attente
**And** il peut ensuite approuver le contenu, auteur ou non

**Given** le détail d'un contenu
**When** l'utilisateur ouvre l'historique
**Then** chaque action est listée, datée et attribuée : création, demande, approbation, retrait, refus et motif, modification, changement de date, marquage publié
**And** un changement de texte ou de date affiche la version précédente

### Story 2.4 : Échanger par commentaires sur un contenu

**Exigences :** FR15

En tant que membre de l'équipe,
je veux commenter un contenu, mentionner l'autre personne et résoudre un commentaire,
afin de discuter d'un post sans quitter l'outil.

**Acceptance Criteria:**

**Given** le détail d'un contenu
**When** un utilisateur écrit un commentaire avec une mention `@`
**Then** le commentaire s'affiche, interne à l'équipe, avec auteur et date
**And** la mention propose les membres de l'annuaire staff (`get_staff_directory`)

**Given** un commentaire ouvert
**When** un utilisateur le marque résolu
**Then** il est replié et ne compte plus dans le compteur de la carte

**Given** une carte du calendrier
**When** des commentaires ouverts existent
**Then** leur nombre apparaît sur la carte

### Story 2.5 : Traiter ses validations depuis « Mes validations »

**Exigences :** FR14

En tant qu'approbateur,
je veux un tableau de tout ce qui attend ma décision, avec un mode revue,
afin de valider vite, comme dans l'écran My approvals de Planable.

**Acceptance Criteria:**

**Given** l'utilisateur connecté
**When** il ouvre « Mes validations »
**Then** trois colonnes s'affichent : « À valider » (tous les contenus en attente, y compris les siens, puisqu'un auteur peut approuver), « Retour laissé » (contenus qu'il a refusés ou commentés, en attente de correction), « Validé » (contenus qu'il a approuvés)
**And** chaque carte montre canaux, heure, visuel, début du texte, statut et nombre de commentaires

**Given** des contenus à valider
**When** l'utilisateur lance le mode revue
**Then** les contenus s'enchaînent un par un, avec approuver, refuser avec motif, commenter, puis passage au suivant

**Given** plusieurs contenus à valider
**When** l'utilisateur clique « Tout approuver » et confirme
**Then** tous passent « approuvé » via la même fonction SQL que l'approbation unitaire

**Given** le menu supertilt.fr
**When** des validations attendent l'utilisateur connecté
**Then** un compteur s'affiche sur l'entrée du sous-module

## Epic 3 : Piloter par campagnes et par vues

Les posts se regroupent en campagnes avec brief, bandeau et calendrier propre ; on les pilote en liste, en aperçu et en grille Instagram, avec filtres combinés et vues enregistrées.

### Story 3.1 : Créer une campagne avec son brief

**Exigences :** FR17

En tant que membre de l'équipe,
je veux créer une campagne avec un brief, des dates et un statut,
afin de cadrer une opération (session inter, AI4Product) avant d'en produire les contenus.

**Acceptance Criteria:**

**Given** l'écran Campagnes du sous-module
**When** l'utilisateur crée une campagne
**Then** il renseigne icône, couleur, nom, statut (préparation par défaut, active, terminée), dates de début et de fin facultatives, liens et brief en texte riche
**And** la campagne apparaît dans la liste, filtrable par onglets Toutes, Actives, En préparation, Terminées

**Given** une campagne existante
**When** l'utilisateur ouvre sa fiche
**Then** l'onglet Vue d'ensemble montre et permet de modifier tous ces champs
**And** la nouvelle table a la RLS `supertilt_fr` et figure dans les listes de sauvegarde

### Story 3.2 : Rattacher les contenus à une campagne et la voir dans le calendrier

**Exigences :** FR18, FR19 ; UX-DR6

En tant que membre de l'équipe,
je veux rattacher mes contenus à une campagne et la voir dans le calendrier,
afin de suivre une opération de bout en bout.

**Acceptance Criteria:**

**Given** le composeur ou le détail d'un contenu
**When** l'auteur choisit une campagne
**Then** le contenu, toutes déclinaisons comprises, est rattaché à cette seule campagne ; en choisir une autre remplace la précédente

**Given** une campagne datée
**When** le calendrier s'affiche
**Then** un bandeau (chevron et nom tronqué) apparaît au-dessus des cartes sur chaque jour couvert (UX-DR6)

**Given** la fiche d'une campagne
**When** l'utilisateur ouvre l'onglet Calendrier
**Then** seuls les contenus de la campagne s'affichent
**And** l'onglet Médias montre les visuels de la Médiathèque utilisés par ses contenus
**And** un bouton « Composer » ouvre le composeur avec la campagne déjà choisie

### Story 3.3 : Piloter les contenus en liste avec des filtres combinés

**Exigences :** FR23, FR24

En tant que membre de l'équipe,
je veux une vue liste de tous les contenus avec des filtres combinés,
afin de piloter la production autrement qu'au calendrier.

**Acceptance Criteria:**

**Given** l'onglet Liste
**When** il s'affiche
**Then** un tableau montre, par contenu : statut affiché, date et heure, canaux, thème, campagne, auteur, début du texte, alertes et nombre de commentaires, trié par date

**Given** le panneau de filtres
**When** l'utilisateur combine validation, publication, campagne, thème, période, canal, auteur et recherche plein texte
**Then** la liste et le calendrier n'affichent que les contenus qui correspondent à tous les filtres
**And** validation et publication se filtrent séparément, comme les deux axes stockés

### Story 3.4 : Relire les contenus en aperçu réseau

**Exigences :** FR23

En tant qu'approbateur,
je veux relire les contenus rendus comme sur leur réseau,
afin de juger le post tel qu'il sera vu.

**Acceptance Criteria:**

**Given** l'onglet Aperçus
**When** il s'affiche
**Then** chaque contenu est rendu à la manière de son réseau (visuel, texte, nom du compte), en version ordinateur ou mobile
**And** ses commentaires sont visibles à côté, avec les gestes de validation de l'epic 2
**And** les filtres actifs s'appliquent

### Story 3.5 : Enregistrer et partager des vues

**Exigences :** FR24 ; UX-DR2

En tant que membre de l'équipe,
je veux enregistrer une combinaison de filtres et la rappeler en un clic,
afin de retrouver mes vues habituelles (« LinkedIn du mois », « à valider pour AI4Product »).

**Acceptance Criteria:**

**Given** des filtres actifs
**When** l'utilisateur les enregistre sous un nom
**Then** la vue apparaît dans la liste déroulante « Vue enregistrée » (UX-DR2)
**And** la sélectionner réapplique tous ses filtres, en calendrier comme en liste

**Given** une vue enregistrée
**When** son auteur la partage
**Then** elle est proposée à l'autre membre de l'équipe ; sinon elle reste personnelle
**And** l'auteur peut la renommer ou la supprimer

### Story 3.6 : Voir la grille Instagram

**Exigences :** FR30 ; UX-DR9

En tant que membre de l'équipe,
je veux voir les posts Instagram disposés comme sur le profil,
afin de juger l'harmonie visuelle avant publication.

**Acceptance Criteria:**

**Given** des posts Instagram publiés et à venir
**When** l'utilisateur ouvre la vue grille Instagram
**Then** les visuels s'affichent en carrés, trois par ligne, du plus récent au plus ancien comme sur le profil, les posts à venir en tête (UX-DR9)
**And** un post sans visuel apparaît en case vide avec l'alerte « visuel manquant »
**And** un clic sur une case ouvre le détail du contenu

**Given** deux posts Instagram à venir dans la grille
**When** l'utilisateur glisse l'un sur la case de l'autre
**Then** leurs dates et heures de publication s'échangent, comme le réordonnancement de Planable
**And** les posts déjà publiés ne se déplacent pas
**And** l'approbation est conservée, puisque seule la date change

## Epic 4 : Rédiger et valider avec Claude via le MCP

Claude lit le contexte de marque, consulte le calendrier, propose des brouillons datés multi-canaux, valide ou refuse et commente, toujours dans le circuit de validation.

### Story 4.1 : Définir le contexte de marque

**Exigences :** FR21

En tant que Romain,
je veux décrire une fois la marque SuperTilt dans le module,
afin que Claude rédige toujours avec le bon ton, les bonnes offres et le bon vocabulaire.

**Acceptance Criteria:**

**Given** les réglages du sous-module Contenus sociaux
**When** l'utilisateur ouvre « Contexte de marque »
**Then** il renseigne description, produits et services, ton, valeurs, terminologie validée et audience, en texte libre, enregistrés en continu

**Given** le connecteur MCP SuperTools
**When** Claude appelle l'outil de lecture du contexte de marque
**Then** il reçoit ces six champs à jour
**And** les instructions du serveur MCP lui demandent de lire ce contexte avant de proposer un contenu

### Story 4.2 : Consulter le calendrier depuis Claude

**Exigences :** FR27

En tant que Romain dans Claude,
je veux lister et lire les contenus planifiés,
afin que Claude repère les trous, les validations en attente et les contenus incomplets.

**Acceptance Criteria:**

**Given** le serveur MCP existant (`supabase/functions/mcp-server/index.ts`), sans second serveur
**When** Claude liste les contenus
**Then** il peut filtrer par statut de validation, statut de publication, période, canal, thème et campagne
**And** chaque contenu renvoie son statut affiché, ses déclinaisons, sa date, son thème, sa campagne et ses alertes (même fonction que la story 1.3)

**Given** des contenus en attente de validation
**When** Claude demande les validations à suivre
**Then** elles sont classées par date de sortie, la plus proche d'abord, et celles qui sortent sous 48 h sont signalées

**Given** un contenu
**When** Claude le lit
**Then** il reçoit texte, visuel, canaux, commentaires et historique de validation

**Given** les outils de référence
**When** Claude a besoin d'identifiants
**Then** il peut lister les canaux, les thèmes et les campagnes
**And** chaque appel est journalisé dans `agent_query_audit_log`, la version du serveur est incrémentée et `docs/mcp-connector.md` est mis à jour

### Story 4.3 : Créer des brouillons datés depuis Claude

**Exigences :** FR28

En tant que Romain dans Claude,
je veux que Claude crée des brouillons multi-canaux avec une date proposée,
afin de produire un lot de contenus à partir d'un brief en une conversation.

**Acceptance Criteria:**

**Given** un brief dans la conversation
**When** Claude crée un brouillon
**Then** il fournit canaux, format, texte, thème et campagne facultatifs, visuel de la Médiathèque facultatif et date proposée
**And** un contenu groupé est créé, une déclinaison par canal, comme depuis le composeur

**Given** un brouillon créé par Claude
**When** il est enregistré
**Then** son statut de validation est « non demandée », ou « en attente » si l'appel le demande ; jamais « approuvé »
**And** il est marqué « créé par Claude » dans l'historique, avec l'utilisateur du connecteur comme auteur
**And** la réponse de l'outil renvoie les alertes du contenu (visuel manquant, texte trop long)

**Given** l'outil de création
**When** il est appelé
**Then** il ne fait qu'ajouter : aucun contenu existant n'est modifié ni supprimé

### Story 4.4 : Valider, refuser, programmer et commenter depuis Claude

**Exigences :** FR29

En tant que Romain dans Claude,
je veux approuver, refuser avec motif, programmer et commenter des contenus,
afin de traiter mes validations sans quitter la conversation.

**Acceptance Criteria:**

**Given** un contenu en attente
**When** Claude l'approuve ou le refuse avec motif
**Then** la transition passe par la même fonction SQL que l'écran (story 2.1), avec les mêmes règles : motif obligatoire, effet sur tout le groupe, action quotidienne, historique
**And** les instructions du serveur imposent l'accord explicite de l'utilisateur dans la conversation avant toute approbation ou tout refus

**Given** un contenu
**When** Claude le programme en posant ou déplaçant sa date et son heure
**Then** seule la date change, sur tout le groupe, et l'approbation est conservée, comme un glisser-déposer dans le calendrier
**And** un contenu déjà marqué publié ne peut pas être reprogrammé par Claude

**Given** un contenu
**When** Claude lit ou ajoute un commentaire
**Then** le commentaire apparaît dans le détail du contenu, attribué à l'utilisateur du connecteur et marqué « via Claude »

## Epic 5 : Sortir les posts du kanban newsletter

Les 6 cartes post deviennent des posts, plus aucune entrée ne crée de post dans le kanban, et un post peut décliner une carte éditoriale avec un lien dans les deux sens.

### Story 5.1 : Migrer les cartes post et rediriger leurs points d'entrée

**Exigences :** FR25

En tant que Romain,
je veux que les posts sociaux quittent le kanban newsletter et n'y reviennent plus,
afin que le kanban ne porte que les articles et que les posts vivent dans le calendrier.

**Acceptance Criteria:**

**Given** les 6 cartes `content_cards` de type `post` ou `post_linkedin`
**When** la migration de données est jouée en production, après la publication du front, une seule fois, de façon idempotente
**Then** chaque carte devient un contenu avec son titre et sa description comme texte, son échéance comme date, son visuel et son thème s'il y a lieu
**And** les cartes en « Diffusion Terminée » deviennent « marqué comme publié », celle en « Idées » un brouillon sans date
**And** le canal de chaque carte est confirmé par Romain avant l'exécution (un `post` générique ne dit pas son réseau)
**And** l'historique du contenu indique « migré depuis la carte … »
**And** la carte d'origine est retirée du kanban une fois le contenu créé ; un rapport liste les 6 cartes, le contenu créé et toute carte ignorée

**Given** le bouton « Envoyer au tableau de contenu » d'un événement (`SendToContentBoardButton`)
**When** l'utilisateur choisit Post LinkedIn ou Post Instagram
**Then** un brouillon sans date est créé dans Contenus sociaux, sur le canal correspondant, au lieu d'une carte du kanban

**Given** une recommandation éditoriale acceptée au format `post_linkedin` (`useEditorialRecommendations`)
**When** elle est acceptée
**Then** elle crée un brouillon dans Contenus sociaux, et non une carte `post` dans le kanban

**Given** le kanban newsletter après la story
**When** un utilisateur crée ou modifie une carte
**Then** les types post ne sont plus proposés ; les outils MCP `create_content_card` et `add_content_card` refusent ces types et orientent vers les outils de l'epic 4

### Story 5.2 : Décliner une carte éditoriale en contenus sociaux

**Exigences :** FR26

En tant que membre de l'équipe,
je veux décliner un article du kanban en posts et retrouver le lien des deux côtés,
afin de promouvoir chaque article sur les réseaux sans perdre le fil.

**Acceptance Criteria:**

**Given** une carte du kanban éditorial
**When** l'utilisateur clique « Décliner en posts »
**Then** le composeur s'ouvre, rattaché à cette carte, avec son titre en point de départ

**Given** le détail d'un contenu
**When** l'utilisateur le rattache à une carte existante, ou retire le lien
**Then** le lien est enregistré ou retiré

**Given** une carte avec des contenus rattachés
**When** son détail s'ouvre dans le kanban
**Then** la liste des contenus liés s'affiche avec leur statut, chacun ouvrable d'un clic
**And** le détail d'un contenu affiche la carte liée, ouvrable d'un clic
**And** l'outil MCP de lecture d'un contenu (story 4.2) renvoie la carte liée
