# Mot de passe obligatoire à l'entrée dans l'espace apprenant

## Objectif

Le lien reçu par mail ne sert plus qu'à ouvrir la porte une fois : avant d'entrer dans son espace, l'apprenant doit créer son mot de passe. Plus aucun accès durable sans mot de passe. L'écran « Vous y êtes » est repris pour être clair, aligné et conforme à la charte.

## 1. Création du mot de passe obligatoire

- À l'ouverture d'un lien, si la personne n'a pas encore de mot de passe, l'écran de création s'affiche et devient un passage obligé.
- Suppression du bouton « Plus tard, accéder directement à ma formation ». Plus aucune sortie possible vers l'espace sans mot de passe enregistré.
- Suppression du retour d'en-tête « Aller à mon espace » sur cet écran, qui contournait la même étape.
- Une personne qui a déjà un mot de passe n'est pas concernée : son lien la connecte directement, comme aujourd'hui.
- Les liens déjà en circulation (Colette, Anna, les inscrits de novembre) continuent de fonctionner et débouchent sur cet écran de création. Aucun renvoi de masse.

## 2. Refonte de l'écran « Vous y êtes »

- Passage de la mise en page en deux colonnes à la carte centrée unique déjà utilisée par les autres écrans de connexion, pour supprimer les décalages.
- Nouveau titre et nouveau texte : on annonce une dernière étape obligatoire, pas une proposition facultative.
- Le panneau latéral actuel disparaît : il affirmait « Le mot de passe est facultatif » et « vous pouvez toujours vous connecter avec un lien reçu par email », deux messages désormais faux.
- Les règles de mot de passe restent affichées avec leurs coches, dans le style des cartes de la charte (fond crème, pas le bloc vert actuel).
- Le pied « Besoin d'aide ? » et la mention de connexion sécurisée sont conservés, identiques aux autres écrans.

## 3. Page de connexion

- Pour une personne qui a un mot de passe, la connexion se fait uniquement par mot de passe, avec « Mot de passe oublié ? ».
- L'envoi d'un lien par mail ne subsiste que pour les comptes qui n'ont pas encore de mot de passe, et pour le mode de secours quand le service d'identification ne répond pas.

## 4. Mail d'accès

- Réécriture du texte du modèle : création du mot de passe présentée comme obligatoire, et suppression de la promesse « valable 1 an et réutilisable » remplacée par la durée réelle du lien et son usage unique.
- Le mail corrigé est renvoyé à Colette avec un lien neuf.

## Détails techniques

- `src/hooks/useLearnerTokenRedemption.ts` : l'étape `password-offer` devient `password-required`, calculée à partir de `user_security_metadata.password_set === false`.
- `src/pages/ConnexionLien.tsx` : remplacement de `AuthSplitCard` par `AuthCard`, suppression du bouton d'échappement et de `AuthInfoPanel`, `goToSpace()` n'est plus appelé qu'après `updatePassword` + `markPasswordChanged`.
- `src/pages/LearnerPortal.tsx` et le routage post-connexion : garde-fou qui renvoie vers la création du mot de passe si `password_set` est faux, pour couvrir les sessions déjà ouvertes par un lien avant ce changement.
- Modèle d'email `learner_magic_link` (versions tutoiement et vouvoiement) : réécriture du corps.
- Tests existants à mettre à jour : `src/hooks/useLearnerTokenRedemption.test.ts`.
- Aucune migration de base, aucune modification du client Supabase unique, aucun retour de `learner-client.ts` ni de l'en-tête `x-learner-email`.
- Vérifications avant commit : `npx tsgo --noEmit -p tsconfig.app.json` et `bash scripts/check-rules.sh` (79/79).
