# Recette fonctionnelle, connexion apprenant

> **Quel document ouvrir ?**
> `docs/SPEC_CONNEXION_APPRENANT.md` — la référence, ce qui doit être fait et pourquoi.
> `docs/RECETTE_FONCTIONNELLE.md` — **le seul à dérouler soi-même**, dans un navigateur, après publication.
> `docs/COUVERTURE_CONNEXION.md` — ce qui garde chaque exigence, et ce que vaut cette garde. Se lit, ne se joue pas.

À dérouler par une personne, dans un navigateur, après la publication en
production. Aucune connaissance technique requise.

Chaque test dit quoi faire, ce qui doit se passer, et quoi faire si ça ne se
passe pas. Notez ce que vous voyez, même quand c'est conforme : « ça marche »
sans détail ne sert à rien le lendemain.

## Avant de commencer

Préparez trois adresses email auxquelles vous avez accès :

- **A** : une adresse déjà apprenante avec un mot de passe connu.
- **B** : une adresse déjà apprenante dont vous ne connaissez pas le mot de passe.
- **C** : une adresse jamais vue par SuperTools.

Plus votre propre compte d'équipe. Gardez un onglet privé pour les tests
apprenants : cela évite de mélanger les sessions.

## Bloc 1 : les cinq tests qui décident

Si l'un des cinq échoue, arrêtez la recette et revenez vers l'équipe technique.
Ils couvrent l'essentiel du risque.

### 1.1 Entrer avec un mot de passe

1. Ouvrir le site, cliquer « Se connecter ».
2. Saisir l'adresse **A**, cliquer « Continuer ».
3. Saisir le mot de passe, valider.

Attendu : l'écran demande l'adresse avant le mot de passe. Après validation,
vous arrivez sur le tableau de bord apprenant, avec vos formations.

Si ça casse : c'est le parcours le plus emprunté. Arrêt immédiat.

### 1.2 Compte sans mot de passe encore défini (mis à jour le 2026-09-18, le lien magique n'existe plus)

1. Trouver ou créer un compte dont vous savez qu'il n'a jamais eu de mot de
   passe défini (par exemple juste après le test 3.2 ci-dessous).
2. Ouvrir la page de connexion, saisir cette adresse, cliquer « Continuer ».
3. Vous arrivez sur l'écran mot de passe, comme pour un compte qui en a un.
   Cliquer « Mot de passe oublié ».
4. Relever l'email, cliquer le lien.
5. Vous arrivez directement sur l'écran de choix de mot de passe. Choisir un
   mot de passe et valider.

Attendu : aucune session ne s'ouvre avant votre clic sur « Enregistrer mon
nouveau mot de passe » à l'étape 5 (RG-21 : le lien ne doit rien consommer
tout seul au chargement de la page, pour rester utilisable même si votre
messagerie d'entreprise l'a ouvert avant vous — mais sans écran ni clic
supplémentaire imposé : enregistrer le mot de passe suffit). Une fois le mot
de passe défini, vous arrivez dans l'espace apprenant, et une reconnexion
ultérieure utilise ce mot de passe.

Si ça casse : c'est le cœur de la démolition du lien magique. Arrêt immédiat.
Notez à quelle étape : toujours aiguillé vers un ancien écran de lien, email
non reçu, ou session ouverte avant votre clic à l'étape 5 (régression grave,
à signaler immédiatement : plus aucun mécanisme ne doit ouvrir de session
sans mot de passe saisi ni consommer un lien sans votre clic).

### 1.3 Un ancien lien magique ne mène plus à une impasse

1. Retrouver un email d'accès reçu **avant** la démolition (avant le
   2026-09-18), ou construire l'URL `/connexion/lien?token=nimportequoi`.
2. Ouvrir ce lien.

Attendu : vous arrivez sur la page de connexion normale, jamais sur une page
« introuvable » ni sur une erreur technique.

Si ça casse : des apprenants ayant un ancien email en main tombent dans une
impasse. Arrêt.

### 1.4 L'équipe entre toujours

1. En navigation normale, aller sur la page de connexion de l'équipe.
2. Se connecter avec son compte habituel.

Attendu : arrivée au tableau de bord du back-office, sans aller-retour ni écran
intermédiaire. Si un changement de mot de passe est demandé, le faire : après
validation, vous devez arriver dans le back-office et **ne plus jamais** revenir
sur cet écran aux connexions suivantes.

Si ça casse : l'équipe ne travaille plus. Arrêt immédiat.

### 1.5 Une adresse inconnue n'enferme personne

1. Page de connexion, saisir l'adresse **C**, « Continuer ».

Attendu : un message disant qu'aucun compte n'a été trouvé, avec au moins une
porte de sortie visible : essayer une autre adresse, découvrir les formations,
écrire au support. Pas d'écran d'erreur, pas de page blanche.

## Bloc 2 : les parcours du quotidien

### 2.1 Mot de passe oublié

1. Page de connexion, adresse **A**, « Continuer », puis « Mot de passe oublié ».
2. Valider, relever l'email, ouvrir le lien.
3. Choisir un nouveau mot de passe et valider.
4. Se reconnecter avec ce nouveau mot de passe.

Attendu : l'email arrive, le lien mène directement à l'écran de choix de mot
de passe avec les règles affichées (RG-21, voir test 1.2 : rien n'est
consommé avant votre clic sur « Enregistrer »), et la nouvelle connexion
fonctionne.

### 2.2 Un mot de passe est désormais nécessaire pour entrer (mis à jour le 2026-09-18)

1. Reprendre le compte du test 1.2, une fois son mot de passe défini.
2. Se déconnecter, puis se reconnecter avec ce mot de passe.

Attendu : la reconnexion se fait par mot de passe, comme n'importe quel autre
compte. Il n'existe plus de parcours où l'on entre indéfiniment sans jamais en
définir un.

### 2.3 Un lien de réinitialisation déjà utilisé

1. Reprendre l'email de réinitialisation du test 1.2 ou 2.1, déjà utilisé, et
   cliquer à nouveau son lien.

Attendu : un message disant que le lien a expiré, **avec le bouton pour en
recevoir un nouveau sur place**. Cliquer dessus doit envoyer un nouvel email.

### 2.4 Les anciennes adresses fonctionnent encore

1. Retrouver un ancien email d'accès, envoyé avant la refonte ou avant la
   démolition du lien magique.
2. Cliquer son lien.

Attendu : vous arrivez sur la page de connexion normale, jamais sur une
erreur ni sur un ancien écran d'ouverture de lien.

### 2.5 La déconnexion

1. Depuis l'espace apprenant, se déconnecter.

Attendu : retour à l'accueil du site, pas sur un écran qui redemande de se
connecter.

### 2.6 Revenir à l'endroit demandé

1. Déconnecté, ouvrir directement l'adresse d'une page de l'espace apprenant,
   par exemple la page des travaux.
2. Se connecter.

Attendu : après connexion, vous arrivez sur la page demandée, pas sur le
tableau de bord.

## Bloc 3 : côté équipe

### 3.1 Le bandeau d'information

1. Paramètres généraux, activer le bandeau, modifier le texte, enregistrer.
2. Ouvrir la page de connexion en navigation privée.
3. Désactiver, recharger.

Attendu : le bandeau apparaît puis disparaît, avec le texte réglé.

### 3.2 Inscrire un participant à une formation en ligne (mis à jour le 2026-09-18)

1. Inscrire une adresse à laquelle vous avez accès sur une formation
   e-learning.
2. Relever l'email reçu.

Attendu : l'email dit « Créez votre mot de passe pour y accéder », avec un
seul bouton. Ce n'est plus un lien qui connecte tout seul (voir test 1.2 pour
la suite du parcours, jusqu'à l'espace apprenant).

### 3.3 Mon espace apprenant depuis le back-office

1. Dans le menu de votre compte, cliquer « Mon espace apprenant ».

Attendu : votre propre espace apprenant s'ouvre.

### 3.4 Changer l'adresse d'un apprenant

À ne faire qu'une fois, sur un apprenant de test.

1. Administration des apprenants, changer l'adresse.
2. Vérifier que ses formations sont toujours là.
3. Vérifier les deux emails, vers l'ancienne et la nouvelle adresse.
4. Sur la page de connexion, saisir l'ancienne adresse.

Attendu : formations intactes, deux emails partis, l'ancienne adresse n'est
plus reconnue (état « aucun compte trouvé »).

## Bloc 4 : après les migrations différées

Ces tests ne valent qu'une fois jouées les migrations de
`supabase/migrations-apres-front/`.

### 4.1 Le texte des emails

Déclencher l'envoi de l'email d'accès (test 3.2). Il doit annoncer sa durée
réelle (1 heure pour le lien de création de mot de passe) et mentionner la
création du compte ainsi que le moyen d'en demander la suppression — ce que
le texte actuellement livré ne fait pas encore (écart connu, chapitre 11 de
`docs/SPEC_CONNEXION_APPRENANT.md`).

### 4.2 L'équipe et le changement de mot de passe

Refaire le test 1.4 avec un compte marqué « doit changer son mot de passe ».
Après changement, la contrainte doit être levée définitivement.

## Ce qu'il faut noter pour chaque anomalie

- L'adresse utilisée et le test concerné.
- L'heure, à la minute : elle permet de retrouver la trace côté serveur.
- Ce que vous attendiez, ce que vous avez vu.
- L'adresse de la page au moment du problème, copiée depuis la barre du
  navigateur.
- Une capture d'écran.

## Arrêt immédiat si

- Un apprenant ne peut plus entrer par aucun chemin.
- L'équipe ne peut plus entrer.
- Un apprenant voit les données de quelqu'un d'autre.
- Un email part avec un lien qui ne fonctionne pas.

Dans ces cas, le retour arrière consiste à republier la version précédente du
front. Les migrations déjà appliquées ne détruisent aucune donnée : elles
ajoutent des fonctions et resserrent des droits. Le détail des retours arrière
est dans `docs/AUDIT_AVANT_PUSH.md`, chapitre 3.
