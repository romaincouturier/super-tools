# Recette fonctionnelle, connexion apprenant

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

### 1.2 Entrer sans mot de passe, par un lien

1. Ouvrir la page de connexion en navigation privée.
2. Saisir l'adresse **B**, cliquer « Continuer ».
3. Relever l'email reçu, cliquer le lien.
4. Sur la page d'arrivée, cliquer « Ouvrir mon espace ».

Attendu : l'email arrive en moins de deux minutes. Le lien mène à une page qui
demande une action avant d'ouvrir la session, pas à un mot de passe. Après le
clic, vous êtes connecté.

Si ça casse : c'est le cœur de la refonte. Arrêt immédiat. Notez à quelle
étape : email non reçu, lien qui n'ouvre rien, ou page d'erreur.

### 1.3 Le lien ne s'use pas tout seul

1. Redemander un lien pour **B**.
2. Ouvrir l'email, **ne pas cliquer**. Attendre deux minutes.
3. Cliquer ensuite, puis « Ouvrir mon espace ».

Attendu : le lien fonctionne encore. Il ne doit pas avoir été consommé par
l'ouverture de l'email ou par le filtre de sécurité de la messagerie.

Si ça casse : les apprenants en entreprise ne pourront pas se connecter. Arrêt.

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
2. Valider, relever l'email, ouvrir le lien, choisir un nouveau mot de passe.
3. Se reconnecter avec ce nouveau mot de passe.

Attendu : l'email arrive, le lien mène à un écran de choix de mot de passe avec
les règles affichées, et la nouvelle connexion fonctionne.

### 2.2 Le mot de passe reste facultatif

1. Se connecter par lien avec **B**.
2. Quand l'écran propose de définir un mot de passe, cliquer « Plus tard ».
3. Se déconnecter, puis se reconnecter par lien.

Attendu : « Plus tard » mène directement à l'espace. La reconnexion par lien
fonctionne autant de fois que voulu.

### 2.3 Un lien déjà utilisé

1. Reprendre l'email du test 1.2, déjà utilisé, et cliquer à nouveau.
2. Cliquer « Ouvrir mon espace ».

Attendu : un message disant que le lien a déjà servi, **avec le bouton pour en
recevoir un nouveau sur place**. Cliquer dessus doit envoyer un nouvel email.

### 2.4 Les anciennes adresses fonctionnent encore

1. Retrouver un ancien email d'accès, envoyé avant la refonte.
2. Cliquer son lien.

Attendu : vous arrivez sur la nouvelle page d'ouverture de lien, pas sur une
erreur. Le lien fonctionne ou propose d'en recevoir un neuf.

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

### 3.2 Inscrire un participant à une formation en ligne

1. Inscrire une adresse à laquelle vous avez accès sur une formation
   e-learning.
2. Relever l'email reçu, cliquer le lien, ouvrir l'espace.

Attendu : l'email annonce une activation, pas un achat. Le lien connecte et mène
à la formation. La durée annoncée dans l'email correspond à ce que fait le lien.

### 3.3 Mon espace apprenant depuis le back-office

1. Dans le menu de votre compte, cliquer « Mon espace apprenant ».

Attendu : votre propre espace apprenant s'ouvre.

### 3.4 Changer l'adresse d'un apprenant

À ne faire qu'une fois, sur un apprenant de test.

1. Administration des apprenants, changer l'adresse.
2. Vérifier que ses formations sont toujours là.
3. Vérifier les deux emails, vers l'ancienne et la nouvelle adresse.
4. Reprendre un ancien lien envoyé à l'ancienne adresse et le cliquer.

Attendu : formations intactes, deux emails partis, ancien lien refusé avec
proposition d'en recevoir un neuf.

## Bloc 4 : après les migrations différées

Ces tests ne valent qu'une fois jouées les migrations de
`supabase/migrations-apres-front/`.

### 4.1 Le texte des emails

Déclencher un envoi de lien. L'email doit annoncer un lien qui connecte sans
mot de passe, sa durée réelle, et mentionner la création du compte et le moyen
d'en demander la suppression.

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
