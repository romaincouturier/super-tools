# REA Planable

Nov 3, 2026 · @Romain

## Périmètre et sources

Le relevé combine la documentation publique et l'observation de l'application le 3 novembre 2026, dans l'espace d'exemple d'un compte d'essai. Les champs cités viennent des réponses de l'API interne de l'application (tRPC), lues en navigation, sans rien créer ni modifier. Le MCP n'est pas encore branché : ses schémas exacts restent à confirmer.

| Source | Ce qu'elle apporte | Statut |
| --- | --- | --- |
| [Guide MCP pour Claude](https://planable.io/guides/planable-mcp-connector-claude/) | Capacités MCP par famille, 6 skills | Lu |
| [Aide : connecter le MCP](https://help.planable.io/hc/en-us/articles/27538577098780-How-to-connect-Planable-MCP-to-your-AI-tools) | Périmètre complet du MCP, limites de session | Lu |
| [Catalogue Vinkius](https://vinkius.com/apps/planable-mcp/with/llamaindex) | 10 noms d'outils MCP, statuts de post | Lu (source tierce) |
| [Guide API publique](https://planable.io/guides/planable-public-api/) | Objets, règles de modification | Lu |
| [Aide : réglages d'espace](https://help.planable.io/hc/en-us/articles/21796309997596-Change-workspace-settings) | Validation, labels, modèles, créneaux | Lu |
| [Aide : validation](https://help.planable.io/hc/articles/21715462785180) et [multi-niveaux](https://help.planable.io/en/articles/3653801-multi-level-approvals) | Types de validation, verrouillage | Lu |
| [Page Campagnes](https://planable.io/campaigns/) | Objet campagne | Lu, peu détaillé |
| [Dépôt GitHub des skills](https://github.com/Planable/smm-skills/) | Prompts des skills | Non accessible depuis ma session |
| Application + MCP branché | Écrans, filtres, champs réels de l'API interne | Fait (espace d'exemple) ; MCP à brancher |

## Carte de l'application

Planable s'organise en six modules accessibles depuis le menu de gauche, sous une barre « Channels » qui filtre tous les écrans par compte.

&#91;embedded content: carte de Planable · 6 modules\]

Content, Campaigns et My approvals tournent sur les données propres à l'outil. Social inbox, Analytics et Social listening ne vivent que des données remontées par les réseaux.

## 1. Content

Le cœur de l'outil : planifier, rédiger et faire valider les posts de tous les canaux dans un même calendrier.

| Écran | Ce qu'on y fait |
| --- | --- |
| Calendrier (mois, semaine) | Voir posts, campagnes en bandeau, notes du jour, réunions d'un agenda importé ; ajouter un post ou une note sur un jour ; glisser-déposer |
| Colonne « Saved » | Brouillons sans date, à glisser dans le calendrier |
| Autres vues | Aperçu (rendu réseau), liste, grille Instagram ou TikTok |
| Filter & sort | Filtres par validation, publication, retours, campagne, label, période, type, auteur, recherche ; posts équipe seule ou archivés |
| Composeur | Canaux, modèle, campagne, labels, format (post, story, reel), texte avec IA, date, « Save draft » |
| Détail de post | Aperçu ordinateur ou mobile, réécriture IA, hashtags, commentaires, notes internes, suggestions de texte, validation |

La barre latérale « Channels » sert de filtre global : chaque canal se coche ou se décoche. Elle mélange réseaux sociaux (Facebook, X, LinkedIn page et profil, Instagram, Google Business, YouTube, TikTok, Pinterest, Threads) et canaux libres (Blog, Newsletter).

Détail des données, statuts et filtres dans les sections dédiées plus bas.

## 2. Campaigns

Une campagne est un mini-espace : son brief, ses posts, ses médias et ses résultats, sur une période donnée.

| Écran | Ce qu'on y fait |
| --- | --- |
| Liste | Cartes de campagne avec dates et statut ; onglets Toutes, Actives, En préparation, Terminées ; « New campaign » |
| Fiche > Overview | Icône, nom, statut, dates, liens, brief en texte riche (objectif, phases, canaux, slogan) |
| Fiche > Calendar | Calendrier limité aux posts de la campagne |
| Fiche > Media | Médias propres à la campagne, à réutiliser dans les posts |
| Fiche > Analytics | Posts, impressions, engagements, taux d'engagement, meilleurs contenus, tableau des contenus |
| Bouton Compose | Créer un post déjà rattaché à la campagne |

Statuts observés : Active, Planning, Completed.

## 3. My approvals

Le poste de travail du valideur : tout ce qui attend sa décision, rangé en trois colonnes.

| Élément | Ce qu'on y fait |
| --- | --- |
| Colonne « Awaiting approval » | Posts qui attendent ma validation |
| Colonne « Feedback left » | Posts sur lesquels j'ai laissé un retour, en attente de correction |
| Colonne « Approved » | Posts que j'ai validés |
| « Review posts » | Mode revue : on enchaîne les posts un par un pour valider ou commenter |
| « Approve all » | Valider d'un coup tout ce qui attend |
| Carte de post | Canal, heure, visuel, début du texte, statut, nombre de commentaires |

Le compteur du menu (12 dans l'exemple) remonte les validations en attente pour l'utilisateur connecté.

## 4. Social inbox

Répondre aux commentaires et aux messages privés de tous les comptes sans ouvrir chaque réseau. Fonctionne comme une boîte de tickets : chaque fil est ouvert ou traité.

| Écran | Ce qu'on y fait |
| --- | --- |
| Comments | Liste des posts publiés qui ont des commentaires ; filtre Ouvert ou Traité ; à droite le post et ses commentaires, bascule « Sans réponse », répondre, aimer, réponse assistée par IA, « Mark as done » |
| DMs | Liste des conversations privées ; fil de discussion, répondre au nom du compte, « Mark as done » |

Canaux couverts dans l'exemple : commentaires sur Facebook, LinkedIn (page et profil), Instagram, TikTok ; messages privés sur Facebook et Instagram seulement. X, YouTube, Pinterest, Threads et Google Business ne sont pas couverts. Les commentaires de publicités Meta demandent de connecter un compte publicitaire.

## 5. Analytics

Deux sous-écrans : ses propres performances (Overview) et la comparaison avec des concurrents (Competitors). Période réglable, « Create report » pour un rapport partageable.

**Overview**

| Bloc | Contenu |
| --- | --- |
| Indicateurs | Abonnés, posts, impressions, engagements, taux d'engagement, chacun avec son évolution sur la période |
| Courbe | Indicateur choisi, total ou par réseau, par jour |
| Tableau par canal | Abonnés, variation, taux de croissance |
| Visibilité IA | Mentions dans les moteurs IA, présence de liens, trafic (via SE Ranking, leur maison mère) |
| Meilleurs contenus | Classés par impressions ou engagements |
| Tableau des contenus | Tous, posts, vidéos, stories ; impressions, vues, engagements, likes, commentaires, partages |

Un interrupteur « Cross-channel view » agrège tous les canaux ; sinon on choisit un canal.

**Competitors**

| Bloc | Contenu |
| --- | --- |
| Sélection | Son compte contre 5 concurrents au plus, par canal |
| Where you stand | Matrice volume de posts × engagement moyen par post, avec 4 quadrants (Efficace, Leader, Discret, Laborieux) ; onglets Croissance et Engagement |
| Quick comparison | Abonnés, posts, engagement, engagement moyen, avec évolution |
| Top contenus | Meilleurs posts des concurrents, par engagement ou récence |
| Par format | Engagement moyen par format (reels, images, texte), soi contre concurrents, avec une phrase de synthèse |

## 6. Social listening

Surveiller ce qui se dit sur les réseaux au-delà de ses propres comptes. Même gabarit d'écran pour la marque, les sujets et les concurrents.

| Écran | Ce qu'on y fait |
| --- | --- |
| Brand | Mots-clés de la marque ; mentions, engagement, répartition du sentiment, courbe du volume (total ou par sentiment), liste des mentions triée par pertinence, export CSV ; collecte périodique (« Next check in 2 days ») |
| Topic | Même écran pour plusieurs sujets suivis (dans l'exemple : jus de pomme, boissons énergisantes, eau gazeuse) |
| Competitors | Même écran pour les marques concurrentes |
| Alerts | Règles d'alerte : plateformes, seuil (plus de 45 mentions par jour, plus de 75 % positif, plus de 20 % négatif), dernier déclenchement, actif ou non |

Une mention porte : auteur, date, plateforme, sentiment modifiable, texte, chiffres d'engagement. Un « contexte de marque » à renseigner améliore le tri par pertinence.

## Détail Content : modèle de données

Le cœur est le post, rattaché à un espace et à une ou plusieurs pages sociales. Un post créé sur plusieurs pages devient un « post groupé » décliné par réseau.

| Objet | Champs observés dans l'application | Remarques |
| --- | --- | --- |
| Espace (`workspace`) | `name`, `timezone`, `websiteUrl`, `labels[]`, `approvalSettings` (`type`, `autoSchedule`, `autoLock`, `sendReminders`), `defaultTeamOnlyPosts` | Les labels sont stockés sur l'espace, pas à part |
| Page sociale (`page`) | Compte connecté ; liste « Channels » du menu, qui inclut aussi « Blog » et « Newsletter » | Les canaux non sociaux sont des pages comme les autres |
| Post | `pageId`, `type` (réseau), `classification` (post), `mediaType` (single-image, video, url-carousel-cta…), `plainText` + `serializedEditorState` (texte riche), `scheduledAt`, `scheduledSet`, `status`, `approved`, `published`, `teamOnly`, `archived`, `labels[]`, `creatorId`, `collaborators[]`, `commentsCounter`, `notesCounter`, `usersNotifiedAt[]`, `createdFrom` | Validation et publication sont des champs séparés |
| Groupe de posts | `groupId`, `groupSync`, `groupPageIds[]` sur chaque post | Un post par réseau, liés par le groupe ; texte synchronisé tant que `groupSync` est vrai |
| Label | `uuid`, `text`, `color` (palette nommée : snowy-mint, pink-lace…) | Copié dans chaque post |
| Campagne | `name`, `description` (brief en texte riche), `icon`, `color`, `status`, `startedAt`, `endedAt`, `links[]` | Le brief est un vrai document : objectifs, phases, canaux |
| Commentaire | `postId`, `text`, `tags[]` (mentions), `teamOnly`, `isFeedback`, `reactions[]`, `resolved` | Interne (note) ou visible client ; peut être résolu |
| Suggestion | Objet séparé (`suggestions.getForPost`) | Propositions de modification du texte |
| Créneau (`postTimeSlot`) | `day`, `hour`, `minute`, `color` au niveau de l'espace, sélection par page | Grille hebdomadaire type |
| Note de calendrier | `notes.list` ; bouton « Note » sur chaque jour | Mémo daté sans publication |
| Agenda externe | `title`, `startDate`, `endDate`, `isAllDay` | Réunions d'un agenda importé affichées dans le calendrier |
| Meilleur horaire | Score par jour et tranche de 3 h, par page | Calculé sur l'historique des publications |
| Préférences utilisateur | Filtres sauvegardés : `mode` (and), `approvalStatus`, `postStatus`, `feedback`, `labels`, `campaigns`, `authors`, `contentTypes`, `sorting` | Les filtres sont mémorisés par personne et par espace |

Règle notable de l'API : un post ne se modifie qu'en brouillon ou programmé ; un post publié renvoie une erreur `POST_ALREADY_PUBLISHED`.

## Détail Content : statuts et circuit de validation

Un post passe par 5 statuts ; en mode « requis », il ne peut être programmé qu'une fois approuvé, et l'approbation le programme automatiquement s'il a déjà une date.

&#91;embedded content: cycle de vie d'un post · 5 statuts\]

Les codes de statut viennent du MCP. Le circuit se règle par espace :

| Type de validation | Effet | Offre |
| --- | --- | --- |
| Aucune | Option masquée, publication libre | Toutes |
| Optionnelle | On peut demander une validation, sans obligation | Toutes |
| Requise | Au moins un approbateur avant programmation | Pro |
| Multi-niveaux | Niveaux nommés, un approbateur suffit par niveau | Enterprise |

Réglages associés : qui peut approuver, programmation automatique à l'approbation, verrouillage du contenu après approbation (texte, médias, date), relances automatiques des approbateurs.

Dans l'application, le schéma ci-dessus est en réalité porté par deux axes indépendants, chacun filtrable :

| Axe | Valeurs observées dans les filtres |
| --- | --- |
| Validation | Approuvé, Non approuvé, Partiellement approuvé, En attente de mon approbation, Demandé par moi |
| Publication | Programmé, Non programmé, Publié, Non publié, Sans date, Marqué comme publié, Publié en pub, Publié en brouillon, Échec de publication, Contenu incompatible, Importé |

Un statut « Marqué comme publié » existe déjà : c'est exactement le mode prévu pour SuperTools en V1. Un contrôle de validité tourne sur chaque post (`posts.getValidations`, `hasErrors`) et donne le statut « Contenu incompatible ».

## Détail Content : vues et filtres

Quatre vues sur les mêmes posts, des filtres combinables, et des vues enregistrées partageables.

| Vue | Usage | Détail relevé |
| --- | --- | --- |
| Calendrier | Planifier | Semaine ou mois ; glisser-déposer ; colonne « Saved » à droite pour les posts sans date ; campagnes en bandeau ; créneaux horaires |
| Aperçu (feed) | Relire | Posts rendus comme sur le réseau, commentaires à côté |
| Liste | Piloter | Tableau des posts avec leurs attributs |
| Grille | Soigner l'image | Rendu du profil Instagram ou TikTok, réordonnable |

Observé dans le panneau « Filter & sort » :

- **Tri** : par date de création (par défaut)
- **Filtres** : statut de validation, statut de publication, retours (commentaires, suggestions, notes internes, commentaires résolus), campagne, labels, période, type de post, contenu, auteur, recherche plein texte
- **Bascules** : masquer les posts réservés à l'équipe, afficher les posts archivés

Dans le calendrier, chaque jour propose deux ajouts rapides, « Post » et « Note ». Les campagnes s'affichent en bandeau, les réunions d'un agenda importé en pastilles horaires, et la colonne « Saved » à droite garde les brouillons sans date. Une carte de post montre label, réseaux, heure, visuel, début du texte, statut de validation et nombre de commentaires.

Le composeur propose : modèle, campagne, labels, format (post, story, reel), texte avec génération par IA, date et heure, « Save draft ». Le détail d'un post ajoute aperçu ordinateur ou mobile, réécriture par IA, génération de hashtags, et un panneau Commentaires / Suggestions avec mentions.

## Règles de gestion observées en écriture

Tests menés le 3 novembre 2026 dans l'espace d'exemple, validation en mode optionnel, verrouillage désactivé. Rien n'a été publié ni envoyé en validation.

| Action testée | Comportement observé | À trancher pour SuperTools |
| --- | --- | --- |
| Ouvrir le composeur | Brouillon serveur sauvegardé en continu, un par format (post, story, reel) et par utilisateur ; on retrouve son brouillon en rouvrant | Garder l'autosauvegarde |
| Choisir plusieurs canaux | Interrupteur « Sync » : un seul texte pour tous les canaux tant qu'il est actif ; avertissement si un canal exige un visuel (Instagram) | Idem |
| « Save draft » sans date | Un post par canal, reliés par un groupe, statut sans date, rangés dans « Saved » | Idem |
| Glisser un brouillon sur un jour | Date posée sur tout le groupe d'un coup (`posts.update` sur les deux posts) | Idem |
| Déplacer un post approuvé | Garde son approbation et son heure, change seulement de jour | Faut-il retirer l'approbation si la date change ? |
| Modifier le texte d'un post approuvé | L'approbation reste, l'historique note « a modifié le texte » | Risque : un texte validé peut changer sans revalidation. Verrouillage ou retour automatique en attente ? |
| Approuver | Un clic sur la coche ; s'applique à tout le groupe ; « Approuvé par Vous » | Validation par groupe ou par canal ? |
| Dévalider | Un second clic retire l'approbation, tracé dans l'historique | Idem |
| Refuser | Pas de bouton « refuser » : le retour passe par un commentaire, le post reste « non approuvé » | Ajouter un vrai refus avec motif ? |
| Commenter | Commentaire visible ou interne (interrupteur), mentions, pièce jointe ; compteur sur la carte | Interne seulement, à deux |
| Demander une validation | Mode sélection dans le calendrier, cases à cocher, puis boîte « Send for approval » : approbateurs à cocher, note facultative, lien à copier | Simplifier : notifier l'autre personne |
| Ajouter une note de calendrier | Un jour, un texte, une couleur parmi 8, visibilité « only-me » par défaut | Utile pour sessions et événements |
| Créer une campagne | Formulaire : icône, nom, statut (Planning par défaut), dates facultatives, liens, brief avec commandes « / » | Idem |
| Rattacher un post à une campagne | Puce « Campaign » du post ; une seule campagne par post | Idem |
| Historique d'un post | Chaque action datée et attribuée, avec aperçu de la version précédente pour les changements de texte et de date | Garder, c'est la traçabilité |

Actions disponibles depuis le menu d'un post : changer de format, republier, détacher du groupe, copier vers un autre espace, dégrouper, masquer aux clients, ajouter à une campagne, enregistrer comme modèle, archiver.

## Réglages de l'espace

Sept écrans de réglages, relevés en lecture seule.

| Écran | Contenu |
| --- | --- |
| Général | Nom, site web, fuseau horaire ; créer les posts en interne par défaut ; masquer les e-mails aux clients ; recadrage auto des images |
| Contexte de marque | Description, produits et services, ton, valeurs, terminologie validée, audience ; utilisé par l'IA de rédaction ; masquable aux clients |
| Équipe et clients | Membres (statut Équipe ou Client, rôle : propriétaire, administrateur, contributeur, approbateur) ; matrice de droits par personne : voir, approuver, modifier, publier, analyser, répondre (inbox), administrer ; notifications |
| Validation | Aucune, optionnelle, requise (offre Pro), multi-niveaux (Enterprise) ; liste de qui peut approuver ; programmation automatique à l'approbation ; verrouillage après approbation ; relances automatiques |
| Modèles | Liste de modèles par canal (texte, hashtags, extraits réutilisables) ; création |
| Labels | Nom, couleur, nombre de posts, dernière utilisation ; recherche, ajout, modification |
| Créneaux | Grille du lundi au dimanche, un ou plusieurs horaires par jour, chacun avec une couleur |

Le « contexte de marque » rejoint ton idée de faire porter la stratégie par Claude : c'est l'équivalent d'un brief permanent que l'IA lit avant de rédiger.

## Catalogue MCP

Le MCP couvre lecture et écriture, mais tout post créé passe par le circuit de validation de l'espace. L'IA n'a que les droits de l'utilisateur connecté ; la session expire après 8 h d'inactivité et le consentement après 180 jours.

| Outil (nom relevé) | Rôle | Paramètres connus |
| --- | --- | --- |
| `list_workspaces` | Espaces accessibles et options actives | Aucun |
| `list_pages` | Pages sociales connectées d'un espace | Espace |
| `list_workspace_members` | Membres et rôles | Espace |
| `list_posts` | Posts filtrés par statut et période | Statut : `draft`, `pending_approval`, `approved`, `scheduled`, `published` |
| `get_post` | Contenu, médias, labels, historique de validation | Id du post |
| `create_post` | Brouillon simple ou groupé multi-réseaux | `workspace_id`, `page_id`, `content`, `scheduled_at` (ISO 8601) |
| `approve_post` | Approuver, y compris en multi-niveaux | Id du post |
| `reject_post` | Refuser avec retour, le post repasse en brouillon | Id du post, commentaire |
| `list_comments` | Notes internes et commentaires clients | Id du post |
| `add_comment` | Ajouter une note ou un commentaire | Id du post, texte |

Noms issus d'un catalogue tiers ; la documentation officielle décrit en plus la mise à jour de brouillons, les labels, les campagnes, les vues, les médias et les statistiques. Le nombre réel d'outils est donc probablement supérieur à 10.

Les 6 skills Claude publiées :

1. **Lot de brouillons** : brief (sujet, réseau, nombre, ton), aperçu avant création, contrôles par réseau (Instagram exige un visuel), création groupée en brouillon.
2. **Validations en attente** : tout ce qui attend une signature, alerte sur les posts qui sortent sous 48 h sans validation, erreurs de publication à part.
3. **Bilan mensuel** : rapport HTML avec indicateurs, répartition par réseau, 5 meilleurs posts.
4. **Audit du calendrier** : posts par statut, sans date, en erreur ; repère les trous et peut les combler en brouillons.
5. **Vue multi-clients** : classement des espaces par engagement ou volume.
6. **Analyse des contenus qui marchent** : motifs récurrents des meilleurs posts, 3 hypothèses à tester.

## Transposition SuperTools

On reprend l'ossature de Planable en la ramenant à un seul espace (SuperTilt), sans publication native et avec une validation à un niveau.

Correspondance module par module, à valider :

| Module Planable | Équivalent SuperTools proposé | Dépendance |
| --- | --- | --- |
| Content | Nouveau module « Contenus sociaux » : calendrier, composeur, détail de post | Aucune, sauf la publication native |
| Campaigns | Campagnes avec brief, calendrier, médias, résultats | Aucune |
| My approvals | Tableau de validation à trois colonnes pour Romain et Emmanuelle | Aucune |
| Social inbox | Commentaires et messages privés | API LinkedIn et Meta, appli validée par chaque réseau |
| Analytics > Overview | Indicateurs par post et par compte, rapprochés des stats web déjà dans SuperTools | API des réseaux, ou import CSV en attendant |
| Analytics > Competitors | Suivi de comptes concurrents ou confrères | Collecte de données publiques |
| Social listening | Rapprochement possible avec le module de veille SuperTools existant | Source de mentions à trouver |

Détail des éléments du module Content :

| Élément Planable | Décision SuperTools | Raison |
| --- | --- | --- |
| Post | Repris, objet à part entière, rattachable à une carte du kanban éditorial | Nettoie le kanban newsletter, permet de décliner un article |
| Post groupé | Repris | Un contenu décliné sur plusieurs comptes |
| Espaces multiples | Abandonné, un seul espace | Pas de clients à séparer |
| Pages sociales | 4 comptes : LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram ; liste extensible | Décision du 3 nov. |
| Labels | Remplacés par des thèmes paramétrables | Thèmes à établir |
| Campagnes | Reprises | Sessions inter, AI4Product |
| Créneaux | À décider | Utile si rythme régulier |
| Modèles | À décider | Utile pour les formats récurrents |
| Validation | Un niveau, approbateur Romain ou Emmanuelle | Décision du 3 nov. |
| Verrouillage après validation | À décider |  |
| Publication | Non native : statut « publié » marqué à la main | Décision du 3 nov. |
| Statistiques | Hors V1, sauf saisie manuelle | Dépend des API des réseaux |
| MCP | Repris sur le modèle Planable : lecture, brouillons avec date proposée, validation, commentaires | Décision du 3 nov. |
| Vues | Calendrier, liste, aperçus ; grille Instagram à décider |  |

Ce que l'observation ajoute à trancher :

- **Deux axes de statut** (validation et publication) plutôt qu'un seul : plus simple à filtrer et à exposer dans le MCP.
- **Statut « marqué comme publié »** : à reprendre tel quel pour la V1 sans publication native.
- **Canaux non sociaux** : Planable traite Blog et Newsletter comme des pages. SuperTools pourrait faire de même pour planifier articles et Déclic dans le même calendrier.
- **Notes de calendrier** et **agenda importé** : utiles pour voir sessions de formation et événements à côté des posts.
- **Brief de campagne en texte riche** : un vrai document par campagne (objectif, phases, canaux).
- **Commentaires internes ou visibles, résolvables, plus suggestions de texte** : à calibrer pour un binôme Romain et Emmanuelle.

## Décisions V1

Périmètre V1 : Content, Campaigns, My approvals et le MCP. Social inbox, Analytics et Social listening attendent un test de faisabilité des API.

| Sujet | Décision |
| --- | --- |
| Modification d'un post approuvé (texte, visuels) | L'approbation saute, retour en attente de validation |
| Changement de date seul | L'approbation est conservée |
| Refus | Bouton refuser avec motif obligatoire, le post revient à l'auteur |
| Portée de l'approbation | Tout le contenu, toutes déclinaisons confondues |
| Approbateurs | Romain ou Emmanuelle, un seul niveau |
| Publication | Non native : statut « marqué comme publié » |
| Comptes | LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram ; liste extensible |
| Canaux libres | Blog et newsletter Le Déclic dans le même calendrier dès la V1 |
| Kanban newsletter | Migration en V1 des cartes qui sont des posts sociaux |
| Thèmes | Paramétrables, liste vide au départ |
| Fonctions secondaires | Notes de calendrier et contexte de marque en V1 ; modèles et créneaux plus tard |
| MCP | Lecture, brouillons avec date proposée, validation et commentaires, sur le modèle Planable |

## Questions ouvertes

À vérifier dans l'application et le MCP branché, avec un compte d'essai :

- [ ] Liste exacte des outils MCP et leurs schémas : à faire en ajoutant `https://mcp.planable.io/mcp` comme connecteur personnalisé dans Claude
- [x] Post groupé : un post par réseau, liés par `groupId`, texte synchronisé tant que `groupSync` est vrai
- [x] Champs d'une campagne : nom, brief, icône, couleur, statut, début, fin, liens
- [x] Créneaux : jour, heure, minute, couleur au niveau de l'espace, sélectionnés par page
- [ ] Ce qui arrive à un post refusé : pas de refus explicite, le retour passe par un commentaire (voir règles de gestion)
- [ ] Contrôles par réseau : le mécanisme existe (`getValidations`), le détail des règles reste à voir

À trancher côté SuperTools :

- [ ] Liste des thèmes éditoriaux
- [ ] Créneaux, modèles, verrouillage après validation, grille Instagram : V1 ou plus tard
- [ ] Lien avec le kanban newsletter : quelles cartes migrent vers les posts
