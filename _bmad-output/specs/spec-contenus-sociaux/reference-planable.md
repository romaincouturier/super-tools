# Référence Planable

Relevé du 3 novembre 2026 : documentation publique et API interne lues en navigation sur un compte d'essai. C'est une référence de conception. Seuls les choix retenus dans SPEC.md engagent SuperTools.

## Objets observés

| Objet | Champs | Reprise SuperTools |
| --- | --- | --- |
| Post | canal, format (post, story, reel), texte brut + texte riche, date programmée, statut, approuvé, publié, archivé, labels, auteur, collaborateurs, compteurs commentaires et notes | Oui, labels remplacés par un thème |
| Groupe de posts | identifiant de groupe, synchro du texte, liste des canaux | Oui |
| Campagne | nom, brief en texte riche, icône, couleur, statut (Planning, Active, Completed), début, fin, liens | Oui |
| Commentaire | post, texte, mentions, interne ou visible, retour, réactions, résolu | Interne uniquement |
| Suggestion de texte | objet séparé, propositions de modification | À calibrer pour le binôme |
| Note de calendrier | jour, texte, couleur parmi 8, visibilité personnelle par défaut | Oui |
| Créneau | jour, heure, minute, couleur, par canal | Plus tard |
| Agenda externe | titre, début, fin, journée entière | Question ouverte |
| Meilleur horaire | score par jour et par tranche de 3 h, par canal, calculé sur l'historique | Non |
| Préférences | filtres mémorisés par personne : mode, validation, publication, retours, labels, campagnes, auteurs, types, tri | Utile pour les vues enregistrées |

## Filtres et vues

- Vues : calendrier (semaine, mois), aperçu rendu réseau, liste, grille Instagram ou TikTok.
- Filtres : validation, publication, retours (commentaires, suggestions, notes, résolus), campagne, label, période, type, auteur, recherche plein texte. Bascule pour afficher les posts archivés.
- Carte de post dans le calendrier : label, réseaux, heure, visuel, début du texte, statut de validation, nombre de commentaires.
- Chaque jour du calendrier propose deux ajouts rapides : post et note.

## Mes validations

Trois colonnes : à valider, retour laissé, validé. Un mode revue enchaîne les posts un par un. Un bouton « Approve all » valide tout ce qui attend. Le compteur du menu donne le nombre de validations en attente de l'utilisateur connecté.

## Menu d'un post

Changer de format, republier, détacher du groupe, dégrouper, ajouter à une campagne, enregistrer comme modèle, archiver.

## MCP Planable (référence pour CAP-13)

Le relevé vient d'un catalogue tiers, et les schémas ne sont pas confirmés. Tout post créé passe par le circuit de validation. Une session expire après 8 h d'inactivité.

| Outil | Rôle |
| --- | --- |
| `list_posts` | Posts filtrés par statut (`draft`, `pending_approval`, `approved`, `scheduled`, `published`) et par période |
| `get_post` | Contenu, médias, labels, historique de validation |
| `create_post` | Brouillon simple ou groupé, avec `scheduled_at` en ISO 8601 |
| `approve_post` / `reject_post` | Approuver ; refuser avec un commentaire, le post repasse en brouillon |
| `list_comments` / `add_comment` | Notes internes et commentaires |

Familles d'outils montrées dans la maquette (onglet MCP) : lister les espaces, lire les posts, créer un brouillon (jamais publié directement), suivre les validations (urgence selon la date de sortie), programmer (fixer ou déplacer la date d'un post approuvé), lire les statistiques (hors V1).

Skills publiées par Planable, à transposer pour Claude :
- un lot de brouillons créé à partir d'un brief, avec contrôles par réseau ;
- les validations en attente, avec une alerte sur les posts qui sortent sous 48 h sans validation ;
- un audit du calendrier : statuts, posts sans date, trous à combler.

## Contexte de marque

Description, produits et services, ton, valeurs, terminologie validée, audience. L'IA de rédaction le lit avant d'écrire.
