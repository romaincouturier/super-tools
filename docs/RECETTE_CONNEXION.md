# Recette de la refonte de connexion apprenant

Référence : `docs/SPEC_CONNEXION_APPRENANT.md`, chapitre 13 (28 critères d'acceptation).
Méthode : chaque critère porte un scénario métier, joué du point de vue de l'utilisateur,
sans référence technique. Le verdict cite la preuve.

Passe 1 : 2026-09-15. 20 critères tenus, 8 en échec ou partiels, corrigés en passe 2.

## Scénarios et verdicts

| # | Scénario métier | Passe 1 | Passe 2 |
|---|-----------------|---------|---------|
| 1 | Depuis l'accueil, je clique "Se connecter" : j'arrive sur une page qui me demande mon adresse, avec un accès aux formations gratuites. | OK | OK |
| 2 | J'ai un mot de passe. Je saisis mon adresse, puis mon mot de passe, et j'entre. Aucun email requis. | OK | OK |
| 3 | Je clique sur le lien reçu par email. J'arrive connecté sur mon tableau de bord, sans saisir de mot de passe. | **Échec** : les liens émis avant la refonte ouvrent l'ancienne page, qui redemande un mot de passe. | OK |
| 4 | Inscrit à une formation gratuite Academy, je reviens des semaines plus tard et je me reconnecte. | OK | OK |
| 5 | Je tape `/apprenant/connexion` de mémoire, sans lien. | **Échec** : écran "Lien invalide". | OK |
| 6 | Mon lien a expiré ou a déjà servi : l'écran me propose d'en recevoir un nouveau, sur place. | **Partiel** : vrai sur la nouvelle page, faux sur l'ancienne. | OK |
| 7 | Déjà connecté, je clique sur un lien : je ne repasse pas par une authentification. | OK | OK |
| 8 | Je clique sur la notification d'un commentaire. Après connexion, j'arrive sur ce commentaire, pas sur le tableau de bord. | **Partiel** : tenu par mot de passe, perdu quand on entre par lien. | OK |
| 9 | Quelqu'un transfère mon lien d'accès : il ne peut pas changer mon mot de passe. | OK | OK |
| 10 | Je bricole l'adresse du player en mettant l'email d'un collègue : je vois mes données, pas les siennes. | OK | OK |
| 11 | Sans compte, on ne peut pas lire mes formations en connaissant seulement mon adresse. | **Partiel** : deux fonctions fermées, une troisième encore ouverte. | OK |
| 12 | Membre de l'équipe, je me connecte et j'arrive au tableau de bord, sans clignotement ni retour en arrière. | OK | OK |
| 13 | Mon compte n'est rattaché à rien : je vois un écran qui me le dit et me donne un contact. | **Échec** : un compte sans rattachement était traité comme apprenant. | OK |
| 14 | J'achète une formation : je reçois un email d'activation qui m'amène à la formation achetée. | **Partiel** : amenait au tableau de bord, pas à la formation. | OK |
| 15 | Je refuse de créer un mot de passe : j'accède quand même, et je peux revenir par lien autant de fois que je veux. | OK | OK |
| 16 | J'ouvre deux fois le même lien : la seconde fois est refusée et m'en propose un neuf. | OK | OK |
| 17 | J'ouvre un lien trop vieux : refusé de la même façon, avec renvoi. | OK | OK |
| 18 | Aucun email d'accès ne me renvoie vers la boutique pour me connecter. | OK | OK |
| 19 | Je teste des adresses au hasard sur la page de connexion : je n'apprends rien, et je suis freiné. | OK | OK |
| 20 | Je ne peux pas déclarer moi-même que j'ai un mot de passe. | OK | OK |
| 21 | Le support change mon adresse : je garde toutes mes formations, et les anciens liens ne marchent plus. | OK | OK |
| 22 | Après la bascule, mon vieux lien ne me connecte plus mais me propose un lien neuf. | **Partiel** : renvoyait vers l'ancienne page. | OK |
| 23 | L'email d'activation me dit qu'un compte a été créé et comment demander sa suppression. | **Partiel** : vrai dans le texte de repli, absent des modèles. | OK |
| 24 | Mon gestionnaire de mots de passe enregistre bien le couple adresse et mot de passe. | OK | OK |
| 25 | Le service d'aiguillage est en panne : je peux quand même entrer, par mot de passe ou par lien. | OK | OK |
| 26 | J'avais gardé l'ancienne porte `/auth` en signet : je suis routé vers mon espace, sans message d'erreur. | OK | OK |
| 27 | Formateur inscrit à une formation, j'accède à mon espace apprenant depuis le back-office. | **Échec** : aucun chemin. | OK |
| 28 | L'écran `/auth` de l'équipe n'a pas changé. | OK | OK |

## Corrections de la passe 2

| Critères | Constat | Correction |
|----------|---------|------------|
| 3, 5, 6, 22 | L'ancienne page `/apprenant/connexion` survivait avec son comportement d'origine : mot de passe exigé, erreur nue sans jeton, aucune reprise. Les liens en circulation y menaient. | La page est supprimée. `/apprenant/connexion?token=` redirige vers la nouvelle ouverture de lien, sans jeton vers la page de connexion. |
| 8, 14 | La destination était perdue dès qu'on entrait par un lien. | L'ouverture de lien honore une destination portée par l'URL, et l'email d'activation d'une formation en ligne pointe sur le cours concerné. |
| 11 | `learner_evaluation_course_id` prenait encore une adresse en paramètre pour un appelant anonyme. | Exécution anonyme retirée. |
| 13 | Un compte authentifié sans rattachement était traité comme apprenant. | Nouvel état de session, écran "Votre compte n'a pas encore d'accès", niveau d'accès résolu côté serveur. |
| 23 | Les modèles d'email ne disaient rien de la création du compte ni du droit à suppression. | Mention ajoutée aux quatre modèles. |
| 27 | Rien ne menait du back-office à l'espace apprenant. | Entrée "Mon espace apprenant" dans le menu de l'équipe. |

## Passe 3 : vérification des corrections

Chaque correction est couverte par un test qui échouerait si elle disparaissait.

| Critère | Preuve |
|---------|--------|
| 3, 5, 6, 22 | Parcours Playwright : l'ancienne adresse sans jeton mène à la connexion, avec jeton à l'ouverture de lien, et un jeton déjà servi propose le renvoi sur place. |
| 8, 14 | La destination vient de l'URL, sinon du lien lui-même, sinon du tableau de bord ; une formation en ligne renvoie la page de son cours. |
| 11 | Plus aucune fonction de portail n'accepte une adresse en paramètre pour un appelant anonyme. |
| 13 | Parcours Playwright sur l'écran dédié, plus quatre tests unitaires de routage et quatre sur la résolution du niveau d'accès. |
| 23 | Mention ajoutée aux quatre modèles, non rejouée si déjà présente. |
| 27 | Entrée "Mon espace apprenant" dans le menu de l'équipe. |

### Limites connues, assumées

- **Critère 17, lien de réinitialisation.** La durée d'une heure est celle du
  fournisseur d'authentification, réglée hors du code. À vérifier dans la console
  du projet, section Auth.
- **Critère 22.** Le refus d'un jeton de l'ancien régime suppose que la bascule a
  été jouée (`scripts/bascule-connexion.sql`). Avant la bascule, un ancien lien
  connecte normalement, ce qui est le comportement voulu pendant la transition.
- **Critère 14, cours acheté.** La destination pointe sur le cours quand la
  formation est rattachée à un cours en ligne. Sans rattachement, l'apprenant
  arrive sur son tableau de bord, où la formation figure.
- **Ordre de déploiement.** Le front sait se passer de la fonction de niveau
  d'accès tant que la migration n'est pas appliquée : il retombe sur la règle
  précédente plutôt que de déclarer tout le monde sans accès.

---

## Passe 4 : recette élargie à toute la spécification

La passe 1 ne couvrait que les 28 critères d'acceptation. Le reste de la
spécification porte autant d'exigences : 9 principes directeurs, 13 workflows,
26 règles de gestion, le contrat du service de résolution, la table de routage
et les règles anti-boucle. Passe jouée le 2026-09-15 sur ces exigences.

### Écarts trouvés et corrigés

| Exigence | Scénario métier | Constat | Correction |
|----------|-----------------|---------|------------|
| RG-21 | La sécurité de ma messagerie d'entreprise ouvre les liens avant moi. Quand je clique à mon tour, mon lien doit encore marcher. | **Échec.** L'ouverture du lien consommait le jeton dès le chargement de la page : un robot suffisait à le brûler. C'était précisément le risque que la règle décrivait. | La page d'arrivée ne consomme plus rien toute seule : elle affiche "Ouvrir mon espace", et le jeton n'est dépensé qu'après ce clic. |
| RG-08 | Je demande vingt liens d'affilée pour l'adresse de quelqu'un d'autre. | **Échec.** Seul un délai de 60 secondes existait, dans le navigateur, donc contournable. Aucun quota côté serveur. | Quota serveur : 3 envois par adresse et 10 par adresse IP sur une heure glissante. Au-delà, même message, aucun email. |
| RG-24 | Les traces de connexion ne doivent pas s'accumuler au-delà de 30 jours. | **Échec.** La fonction de purge existait mais n'était jamais appelée. | Purge quotidienne planifiée. |
| RG-15 | Le lien que je reçois annonce la bonne durée. | **Échec.** Un lien de connexion de 30 minutes empruntait le modèle d'activation, qui promet 7 jours. | Un lien de connexion rend son propre texte, avec sa durée. |
| W8.5 | Je change mon mot de passe parce que je me crois compromis : les sessions ouvertes ailleurs doivent tomber. | **Échec.** Aucune session n'était fermée. | Les autres sessions du compte sont révoquées, la courante est épargnée. |
| W9.3 | Je me déconnecte : je retourne à l'accueil, pas sur un écran qui me redemande de me connecter. | **Échec.** Le portail renvoyait sur la page de connexion. | Retour à l'accueil. |
| RG-13 | Ma déconnexion ne laisse rien derrière elle sur le poste. | **Partiel.** Seul le portail purgeait l'état local. | La déconnexion générale le purge aussi. |
| Chapitre 7 | On m'impose un changement de mot de passe alors que je visais une page précise : j'y arrive après. | **Échec.** La destination était perdue. | Elle traverse l'écran de changement obligatoire. |
| Chapitre 8 | La contrainte de mot de passe est levée : l'écran ne doit plus me retenir. | **Échec.** L'écran ne relisait pas la contrainte et renvoyait en dur au back-office. | Il la relit, libère vers la destination, et renvoie un visiteur non connecté vers la connexion. |

### Exigences vérifiées sans écart

Principes PR1 à PR9. Workflows W1 à W4, W6, W7, W10 à W13. Règles RG-01 à RG-07,
RG-09 à RG-12, RG-14, RG-16 à RG-20, RG-22, RG-23, RG-25, RG-26. Contrat du
service de résolution, cinq états et seuils. Table de routage, huit lignes.

### Limite restée ouverte

- **RG-25, suppression sous 30 jours.** C'est un engagement de traitement, tenu
  par le support, pas par le code. La politique de confidentialité le porte.
