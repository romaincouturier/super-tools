# Migrations à jouer après la publication du front

Pousser sur GitHub applique tout ce qui se trouve dans `supabase/migrations/`.
Les fichiers placés ici n'y sont pas : ils ne sont donc pas appliqués au push.

Ils portent les changements qui supposent le front publié. Les appliquer plus
tôt casserait l'application actuellement en ligne, de façon silencieuse pour
deux d'entre eux.

Référence : `docs/AUDIT_AVANT_PUSH.md`.

## Comment les jouer, le moment venu

1. Publier le front, et vérifier que la page de connexion répond.
2. Déplacer ces fichiers dans `supabase/migrations/`, sans les renommer.
3. Pousser. Le harnais de règles les reprend automatiquement sous contrôle.

## Ce que chacun attend

| Fichier | Ce qu'il fait | Pourquoi il attend |
|---------|---------------|--------------------|
| `20260915115000_apres_front_retrait_policy_securite.sql` | Retire la permission qui laisse un utilisateur écrire sa ligne de métadonnées de sécurité | Deux écrans du front en ligne écrivent encore directement dans cette table pour lever la contrainte de changement de mot de passe. L'écriture échouerait sans erreur visible, et l'utilisateur boucherait sur cet écran |
| `20260915120000_lot6c_fermeture_entete_apprenant.sql` | `get_learner_email()` cesse de lire l'en-tête du navigateur | Le front en ligne s'en sert pour la prévisualisation d'un espace apprenant par l'équipe |
| `20260915110000_lot6b_modeles_email_acces.sql` | Réécrit les modèles d'email d'accès | Ils annonceraient un lien qui connecte sans mot de passe, quand la page servie en demande encore un |
| `20260915135000_apres_front_mentions_modeles.sql` | Ajoute la mention de création de compte aux modèles | Même raison |
