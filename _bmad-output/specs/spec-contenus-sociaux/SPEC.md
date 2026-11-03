---
id: SPEC-contenus-sociaux
companions:
  - statuts-et-validation.md
  - reference-planable.md
  - brownfield.md
sources:
  - sources/REA_Planable.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Contenus sociaux : planifier, rédiger et valider tous les canaux dans supertilt.fr

## Why

C'est une opportunité à saisir, doublée d'une douleur. Romain et Emmanuelle publient sur quatre comptes (LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram), sur le blog et dans la newsletter Le Déclic, sans calendrier commun ni circuit de validation. Les posts sociaux se mêlent aux articles dans le kanban newsletter, qui n'est pas fait pour eux. Planable a éprouvé l'ossature (calendrier, campagnes, validation, MCP) ; on la reprend ramenée à un seul espace, sans publication native, avec une validation à un niveau et Claude comme rédacteur via le MCP.

## Capabilities

- **CAP-1**
  - **intent:** Romain et Emmanuelle voient dans un calendrier (semaine, mois) tous les posts et contenus de tous les canaux, avec les brouillons sans date à part, et les planifient par glisser-déposer.
  - **success:** Un brouillon sans date glissé sur un jour reçoit cette date sur toutes ses déclinaisons. Décocher un canal dans la barre des canaux le retire de tous les écrans.
- **CAP-2**
  - **intent:** Un auteur rédige un contenu une fois et le décline sur plusieurs canaux, avec format, thème, campagne et date facultative.
  - **success:** Un contenu sur trois canaux crée trois posts liés. Tant que la synchro est active, modifier le texte modifie les trois. Fermer le composeur puis le rouvrir retrouve le brouillon sans perte.
- **CAP-3**
  - **intent:** Chaque post porte deux statuts indépendants, validation et publication, et peut être marqué publié à la main.
  - **success:** Les deux axes se filtrent séparément. Un post approuvé et non publié, puis marqué publié, garde son approbation et passe en « marqué comme publié ». Les valeurs sont dans `statuts-et-validation.md`.
- **CAP-4**
  - **intent:** Un auteur demande une validation, l'approbateur approuve ou refuse avec motif, et une modification du fond annule l'approbation.
  - **success:** Les règles de `statuts-et-validation.md` sont vérifiées par des tests : approbation pour tout le groupe, refus impossible sans motif et renvoyé à l'auteur, retour en attente si texte ou visuel changent, approbation conservée si seule la date change.
- **CAP-5**
  - **intent:** L'approbateur traite ce qui l'attend depuis un tableau « Mes validations ».
  - **success:** Le tableau a trois colonnes (à valider, retour laissé, validé), un mode revue qui enchaîne les posts un par un, et le menu affiche le nombre de validations en attente de l'utilisateur connecté.
- **CAP-6**
  - **intent:** Romain et Emmanuelle échangent sur un post et en retrouvent tout l'historique.
  - **success:** Un commentaire interne accepte les mentions et peut être résolu. L'historique liste chaque action datée et attribuée, avec la version précédente pour un changement de texte ou de date.
- **CAP-7**
  - **intent:** Une campagne regroupe ses posts autour d'un brief, sur une période.
  - **success:** Une campagne a nom, icône, couleur, statut (préparation, active, terminée), dates facultatives, liens et brief en texte riche. Elle s'affiche en bandeau dans le calendrier et a son propre calendrier. Un post créé depuis la campagne y est rattaché. Un post a au plus une campagne.
- **CAP-8**
  - **intent:** Un utilisateur pose une note datée dans le calendrier, sans publication.
  - **success:** Une note a un jour, un texte et une couleur, apparaît sur ce jour et ne compte dans aucun statut de post.
- **CAP-9**
  - **intent:** Un contexte de marque permanent oriente toute rédaction assistée.
  - **success:** Le contexte (description, offres, ton, valeurs, terminologie, audience) est éditable dans le module et lisible par le MCP. Claude le lit avant de proposer un brouillon.
- **CAP-10**
  - **intent:** Les posts se classent par thèmes éditoriaux paramétrables.
  - **success:** La liste de thèmes démarre vide. Un thème se crée, se renomme et sert de filtre.
- **CAP-11**
  - **intent:** Les posts se relisent et se pilotent en liste et en aperçu par réseau, avec des filtres combinables.
  - **success:** Les filtres combinent validation, publication, campagne, thème, période, canal, auteur et recherche plein texte, en vue liste comme en calendrier.
- **CAP-12**
  - **intent:** Les posts sociaux quittent le kanban newsletter et un post peut décliner une carte éditoriale.
  - **success:** Après migration, aucune carte de type post n'est plus dans le kanban newsletter. Chaque carte migrée existe comme post avec son texte et sa date. Un post peut être rattaché à une carte du kanban éditorial, et le lien se suit dans les deux sens.
- **CAP-13**
  - **intent:** Claude, via le connecteur SuperTools, lit les posts, propose des brouillons datés, valide et commente.
  - **success:** Depuis Claude, on peut :
    - lister les posts par statut de validation, de publication et par période ;
    - lire un post avec ses commentaires et son historique ;
    - créer un brouillon groupé multi-canaux avec une date proposée ;
    - approuver, ou refuser avec motif ;
    - lire et ajouter des commentaires.

    Un brouillon créé par Claude part non validé.

## Constraints

- Tout vit dans le module supertilt.fr, en sous-modules. Le droit d'accès est `supertilt_fr` : un droit par module, aucun droit par sous-module.
- Aucune publication native vers les réseaux en V1 : le statut publié se marque à la main.
- Un seul espace, SuperTilt. Pas de clients, pas de séparation équipe/client ni de visibilité « client ».
- Validation à un seul niveau ; approbateurs : Romain ou Emmanuelle.
- Les canaux sont une liste extensible. Blog et Le Déclic sont des canaux comme les comptes sociaux.
- Le MCP n'a que les droits de l'utilisateur connecté, et aucun de ses chemins ne contourne le circuit de validation.
- Conventions du dépôt : flux page, hook, service, Supabase ; RLS sur chaque table ; écrans internes masqués en mode démo. Voir `brownfield.md`.

## Non-goals

- Social inbox (commentaires et messages privés), Analytics, comparaison concurrents, Social listening : en attente d'un test de faisabilité des API LinkedIn et Meta.
- Publication automatique sur les réseaux.
- Validation multi-niveaux, espaces multiples, portail client.
- Modèles de posts et créneaux horaires : plus tard.
- Génération d'images ou de vidéos.

## Success signal

- Une semaine planifiée de bout en bout. Claude crée cinq brouillons datés sur les quatre comptes et le blog. Emmanuelle en approuve quatre et refuse le cinquième avec motif, depuis Mes validations. Romain corrige le refusé, qui repasse en attente, puis il est approuvé. Les cinq sont ensuite marqués publiés.
- Le kanban newsletter ne contient plus aucune carte post.

## Assumptions

- Cartes à migrer : les 6 cartes `content_cards` de type `post` ou `post_linkedin`. Les articles restent au kanban.
- Un brouillon créé par Claude part en « non validé » et suit le circuit normal, sans exception.

## Open Questions

- Un auteur peut-il approuver son propre post, ou l'approbation doit-elle venir de l'autre personne ?
- Comment l'autre approbateur est-il notifié d'une demande : action quotidienne, email, les deux ?
- Un post marqué publié reste-t-il modifiable ? Planable l'interdit (`POST_ALREADY_PUBLISHED`).
- Saisie manuelle de statistiques par post : V1 ou plus tard ?
- Google Agenda, sessions de formation et événements affichés dans le calendrier : V1 ou plus tard ?
- Médias de campagne : médiathèque propre à la campagne, ou Médiathèque SuperTools existante ?
- Grille Instagram : V1 ou plus tard ?
- Contrôles par réseau (visuel obligatoire sur Instagram, longueur de texte) : lesquels en V1 ?
- Liste des thèmes éditoriaux de départ.
- Rédaction assistée dans le composeur (génération, réécriture, hashtags) en V1, ou rédaction par Claude via le MCP seulement ?
- Suggestions de texte, séparées des commentaires : utiles au binôme, ou les commentaires suffisent ?
