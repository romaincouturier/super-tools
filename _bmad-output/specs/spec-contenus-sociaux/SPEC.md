---
id: SPEC-contenus-sociaux
companions:
  - maquette-calendrier.md
  - statuts-et-validation.md
  - reference-planable.md
  - brownfield.md
sources:
  - sources/REA_Planable.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Contenus sociaux : planifier, rédiger et valider tous les canaux dans supertilt.fr

## Why

C'est une opportunité à saisir, doublée d'une douleur. Romain et Emmanuelle publient sur six comptes (LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram, YouTube, Facebook), sur le blog et dans la newsletter Le Déclic, sans calendrier commun ni circuit de validation. Les posts sociaux se mêlent aux articles dans le kanban newsletter, qui n'est pas fait pour eux. Planable a éprouvé l'ossature (calendrier, campagnes, validation, MCP) ; on la reprend ramenée à un seul espace, sans publication native, avec une validation à un niveau et Claude comme rédacteur via le MCP.

## Capabilities

- **CAP-1**
  - **intent:** Romain et Emmanuelle voient dans un calendrier (semaine, mois) tous les posts et contenus de tous les canaux, avec les brouillons sans date à part, et les planifient par glisser-déposer.
  - **success:** Chaque jour du calendrier montre un aperçu de ses contenus, conforme à `maquette-calendrier.md` : heure, statut, canaux, couleur du thème, début du titre. Un brouillon sans date glissé sur un jour reçoit cette date sur toutes ses déclinaisons. Décocher un canal le retire de tous les écrans.
- **CAP-2**
  - **intent:** Un auteur rédige un contenu une fois et le décline sur plusieurs canaux, avec format, thème, campagne et date facultative.
  - **success:** Un contenu sur trois canaux crée trois posts liés. Tant que la synchro est active, modifier le texte modifie les trois. Fermer le composeur puis le rouvrir retrouve le brouillon sans perte.
- **CAP-3**
  - **intent:** Chaque post porte deux statuts indépendants, validation et publication, affichés sur une seule échelle, et peut être marqué publié à la main.
  - **success:** L'écran affiche une seule échelle : Brouillon, En validation, Approuvé, Programmé, Publié. Elle est calculée à partir des deux axes stockés, selon la correspondance de `statuts-et-validation.md`. Les deux axes restent filtrables séparément. Un post approuvé, puis marqué publié, garde son approbation.
- **CAP-4**
  - **intent:** Un auteur demande une validation, l'approbateur approuve ou refuse avec motif, et une modification du fond annule l'approbation.
  - **success:** Les règles de `statuts-et-validation.md` sont vérifiées par des tests :
    - l'approbation vaut pour tout le groupe ;
    - un refus est impossible sans motif, et le post revient à l'auteur ;
    - modifier le texte ou un visuel remet le post en attente ;
    - changer seulement la date conserve l'approbation ;
    - une demande de validation crée une action quotidienne pour l'autre approbateur ;
    - un auteur peut approuver son propre post.
- **CAP-5**
  - **intent:** L'approbateur traite ce qui l'attend depuis un tableau « Mes validations ».
  - **success:** Le tableau a trois colonnes (à valider, retour laissé, validé), un mode revue qui enchaîne les posts un par un, et le menu affiche le nombre de validations en attente de l'utilisateur connecté.
- **CAP-6**
  - **intent:** Romain et Emmanuelle échangent sur un post et en retrouvent tout l'historique.
  - **success:** Un commentaire interne accepte les mentions et peut être résolu. L'approbateur corrige directement le texte, sans mode proposition. L'historique liste chaque action datée et attribuée, avec la version précédente pour un changement de texte ou de date.
- **CAP-7**
  - **intent:** Une campagne regroupe ses posts autour d'un brief, sur une période.
  - **success:** Une campagne a nom, icône, couleur, statut (préparation, active, terminée), dates facultatives, liens et brief en texte riche. Elle s'affiche en bandeau dans le calendrier et a son propre calendrier. Ses visuels se prennent dans la Médiathèque existante. Un post créé depuis la campagne y est rattaché. Un post a au plus une campagne.
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
- **CAP-14**
  - **intent:** Romain et Emmanuelle jugent l'harmonie visuelle du profil Instagram avant publication.
  - **success:** Une vue grille montre les posts Instagram publiés et à venir, disposés comme sur le profil, trois par ligne, dans l'ordre de publication.
- **CAP-15**
  - **intent:** Un post incomplet pour son réseau est signalé avant publication.
  - **success:** Un post sans visuel, ou dont le texte dépasse la limite de son réseau, porte une alerte visible sur sa carte, en liste et dans le détail. L'alerte est remontée par le MCP. Elle disparaît une fois le post corrigé.

## Constraints

- Tout vit dans le module supertilt.fr, en sous-modules. Le droit d'accès est `supertilt_fr` : un droit par module, aucun droit par sous-module.
- Aucune publication native vers les réseaux en V1 : le statut publié se marque à la main.
- Un seul espace, SuperTilt. Pas de clients, pas de séparation équipe/client ni de visibilité « client ».
- Validation à un seul niveau ; approbateurs : Romain ou Emmanuelle, auteur compris.
- La rédaction assistée passe uniquement par Claude via le MCP : aucune IA de rédaction dans le composeur.
- Canaux de départ : LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram, YouTube, Facebook, Blog, Le Déclic. La liste est extensible, et Blog et Le Déclic sont des canaux comme les autres.
- Toute publication porte un visuel, quel que soit son canal.
- Les visuels viennent de la Médiathèque existante : aucune médiathèque propre au module.
- Le MCP n'a que les droits de l'utilisateur connecté, et aucun de ses chemins ne contourne le circuit de validation.
- Conventions du dépôt : flux page, hook, service, Supabase ; RLS sur chaque table ; écrans internes masqués en mode démo. Voir `brownfield.md`.

## Non-goals

- Social inbox (commentaires et messages privés), Analytics, comparaison concurrents, Social listening : en attente d'un test de faisabilité des API LinkedIn et Meta.
- Publication automatique sur les réseaux.
- Validation multi-niveaux, espaces multiples, portail client.
- Modèles de posts et créneaux horaires : plus tard.
- Statistiques par post, même saisies à la main : elles seront automatisées plus tard.
- Google Agenda, sessions de formation et événements dans le calendrier.
- Génération, réécriture ou hashtags par IA dans le composeur.
- Génération d'images ou de vidéos.
- Mode proposition de correction (suggestions à accepter ou rejeter) : l'approbateur modifie directement.

## Success signal

- Une semaine planifiée de bout en bout. Claude crée cinq brouillons datés, chacun avec un visuel de la Médiathèque, sur LinkedIn, Instagram et le blog. Emmanuelle en approuve quatre et refuse le cinquième avec motif, depuis Mes validations. Romain corrige le refusé, qui repasse en attente, puis il est approuvé. Les cinq sont ensuite marqués publiés.
- Le kanban newsletter ne contient plus aucune carte post.

## Assumptions

- Cartes à migrer : les 6 cartes `content_cards` de type `post` ou `post_linkedin`. Les articles restent au kanban.
- Un brouillon créé par Claude part en « non validé » et suit le circuit normal, sans exception.
- Un post refusé s'affiche « Brouillon », avec le motif du refus visible.
- Alertes V1 : visuel absent (tous canaux) et texte au-delà de la limite du réseau. Une alerte n'empêche ni la validation ni le marquage publié.
