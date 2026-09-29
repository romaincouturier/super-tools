# Supprimer les anciens formulaires Google des évaluations

## À modifier
- Remplacer les quatre liens Google Forms encore présents dans les modèles par le lien SuperTools déjà généré pour chaque destinataire.
- Mettre à jour les deux modèles actifs `cold_evaluation_tu` et `cold_evaluation_vous` dans la base pour utiliser `{{evaluation_link}}`.
- Pour le rappel financeur, retirer le formulaire générique : ce message interne renverra vers la fiche formation, où le suivi SuperTools adapté est disponible.
- Vérifier les autres modèles (`email_templates`, `post_evaluation_emails`) et les textes d’invitations pour ne conserver aucun domaine Google Forms.

## Invitations futures existantes
- Interroger les invitations Google Agenda futures accessibles par la connexion existante et relever celles dont la description contient `docs.google.com/forms`, `forms.gle` ou `goo.gl/forms`.
- Fournir la liste sans modifier les invitations existantes.

## Garde anti-régression
- Ajouter un test qui parcourt les modèles de référence du projet et échoue si un domaine Google Forms réapparaît.
- Exécuter les tests ciblés et les contrôles de règles du projet.

## Limite
- Aucun email ne sera envoyé et aucune invitation existante ne sera modifiée automatiquement.
