# Contenus sociaux, lot 1 : enrichir un contenu

## Analyse de l'existant

- **Contenu :** il a aujourd'hui un format, une synchro, un thème unique et un auteur. Les 13 contenus actuels n'ont aucun thème.
- **Déclinaisons :** chacune porte un texte, un visuel de la Médiathèque, une date et un statut. Le statut est indépendant de la date depuis hier, et rien ne change à ce sujet.
- **Thème :** un seul thème par contenu, géré dans Réglages (nom et couleur), qui colore le liseré des cartes et sert de filtre. La liste des thèmes est vide.
- **Cartes du calendrier et de « Non planifiés » :** elles affichent le début du texte, les pastilles des canaux, le statut et les alertes.
- **Liste :** l'onglet « Liste » existe mais il est désactivé, il n'y a pas encore de vue liste.
- **Kanban Newsletter :** chaque carte a un titre, une description et des tags. On peut la lier simplement par son identifiant.
- **Enregistrement :** il passe par une seule fonction de la base (`save_social_content_group`), en enregistrement automatique.

## Recommandations

1. **Expertises = le Thème existant, rendu multi-valeurs.** Je propose de créer les 4 thèmes (Facilitation graphique, Intelligence collective, Transformation, Intelligence artificielle) dans Réglages et de remplacer le thème unique par une liaison plusieurs-à-plusieurs. Le filtre et les couleurs restent ; le liseré prend la couleur de la première expertise. C'est plus simple qu'un second champ qui ferait doublon. L'ancien thème unique est conservé en base, marqué comme retiré, et il est vide partout.
2. **Brief visuel commun uniquement.** Une surcharge par déclinaison doublerait le formulaire pour un besoin rare, puisqu'un carrousel est en général le même partout. On pourra l'ajouter plus tard sans casser le modèle.
3. **Sources :** liens (adresse et libellé facultatif) et lien vers une carte Newsletter, l'un ou l'autre. C'est simple, donc inclus.
4. **Préparation :** 4 cases à cocher, plus « Valider » qui enregistre qui a validé et quand. Décocher une case annule la validation. Un texte modifié après validation ne l'annule pas : aucune règle cachée.
5. **Vue « Liste » :** elle n'existe pas encore. Le lot couvre le calendrier et « Non planifiés » ; je propose de faire la vue Liste dans un lot à part pour ne pas alourdir celui-ci.

## Schéma proposé (ajouts uniquement, aucune donnée modifiée)

Contenu (`social_content_groups`), nouvelles colonnes toutes facultatives :
- `title` : texte court, 120 caractères maximum. Vide signifie qu'on affiche le début du texte, comme aujourd'hui. À l'enregistrement depuis le formulaire, s'il est vide, il est rempli avec le début du texte, ce qui le rend obligatoire sans bloquer un brouillon.
- `editorial_category` : une valeur parmi `tutorial`, `reflection`, `resource`, `behind_the_scenes`, `humor`, `community`, `offer`, ou vide.
- Brief visuel :
  - `visual_type` : `illustration`, `sketchnote`, `carousel`, `photo`, `video`, `diagram` ou `other` ;
  - `visual_message`, `visual_elements`, `visual_texts`, `visual_composition` : textes ;
  - `visual_slides` : liste ordonnée de `{ content }`, le numéro étant la position. Elle est utilisée seulement pour un carrousel et conservée si le type change.
- `internal_notes` : texte, jamais publié.
- Préparation :
  - `check_text_ready`, `check_visual_ready`, `check_links_checked`, `check_proofread` : cases, non cochées par défaut ;
  - `validated_at`, `validated_by` : date et auteur de la validation.
- `origin` : `app` par défaut, `ai` prévu pour le lot 2. Il permettra d'imposer en base qu'une création par l'IA reste en Brouillon, jamais Programmé ni Publié.

Nouvelles tables (droits : administrateur ou module supertilt_fr, comme les contenus) :
- **`social_content_group_themes` :** liaison entre un contenu et un thème (expertise), une ligne par paire, supprimée avec le contenu ou le thème.
- **`social_content_sources` :** contenu, position, adresse, libellé, carte Newsletter liée. Une adresse ou une carte est obligatoire, et l'adresse doit commencer par http(s). La carte est mise à vide si elle est supprimée.

Indicateurs calculés, sans saisie :
- **À compléter :** une case n'est pas cochée.
- **À valider :** toutes les cases sont cochées, mais le contenu n'est pas validé.
- **Validé :** le contenu a été validé.
- **Sans visuel :** au moins une déclinaison non publiée n'a pas de visuel.

Ces indicateurs sont calculés par une fonction partagée, réutilisable par le futur outil MCP.

## Fonctions de la base

- **`save_social_content_group` :** elle reçoit un nouveau paramètre facultatif `p_details` (titre, catégorie, brief, notes, cases, expertises, sources) et enregistre tout en une seule opération. Sans ce paramètre, rien d'autre ne change, donc l'application en ligne continue de fonctionner. La logique de statut d'hier est reprise à l'identique.
- **`validate_social_content(group_id, validated)` :** valide, ou annule la validation, si toutes les cases sont cochées. Elle est tracée avec l'auteur et la date.
- Les valeurs reçues sont contrôlées (catégorie, type de visuel, longueurs, adresses), avec des messages clairs pour une future API.

## Écrans modifiés

- **Formulaire :** le texte par canal reste en tête et ouvert. En dessous, des sections repliables, fermées par défaut, avec un résumé sur une ligne (ex. « Carrousel, 4 diapositives ») :
  - Brief visuel : type, 4 champs, diapositives (ajout, suppression, monter et descendre) visibles seulement pour un carrousel ;
  - Classement : expertises en pastilles à choix multiples, catégorie en liste ;
  - Sources : lignes adresse et libellé, plus « Lier une carte Newsletter » (recherche par titre) ;
  - Notes internes ;
  - Préparation : 4 cases, bouton « Valider » et mention « Validé par X le … ».

  Le champ « Titre interne » est placé au-dessus des canaux.
- **Cartes du calendrier et de « Non planifiés » :** le titre interne remplace le début du texte (le texte reste affiché si le titre est vide). Les pastilles des canaux et le statut sont conservés. S'ajoutent un petit indicateur À compléter, À valider ou Validé, et une icône « sans visuel » qui reprend l'alerte existante.
- **Filtres :** Expertise (les pastilles Thème renommées), Catégorie, et des filtres pratiques Sans visuel, À compléter et À valider, à côté des filtres Réseau et Statut.
- **Réglages :** la rubrique « Thèmes » est renommée « Expertises ».

## Tests ajoutés

Base :
- La modification de la base appliquée deux fois ne modifie ni ne vide aucun contenu existant.
- L'enregistrement sans les nouveaux champs fonctionne comme avant.
- L'enregistrement complet relit à l'identique tous les nouveaux champs.
- Une catégorie, un type de visuel ou une adresse invalides sont refusés.
- La validation est refusée avec une case non cochée, et décocher une case annule la validation.
- Un compte sans droit ne lit ni n'écrit les sources et les expertises.
- Un brouillon incomplet s'enregistre.
- Le statut reste indépendant de la date.

Écran :
- Le titre vide affiche le début du texte.
- Le titre vide est prérempli à l'enregistrement.
- Les indicateurs À compléter, À valider et Validé sont corrects.
- Les filtres expertise, catégorie, sans visuel, à compléter et à valider fonctionnent.
- Les diapositives d'un carrousel s'ajoutent, se suppriment et se réordonnent.

## Hors lot

- Outils MCP (lot 2).
- Vue Liste.
- Surcharge du brief par déclinaison.

## Impact sécurité (PR)

Deux nouvelles tables avec les mêmes droits que les contenus (administrateur ou module), sans accès anonyme. Les fonctions s'exécutent avec les droits de l'appelant. Ajout aux sauvegardes quotidiennes.
