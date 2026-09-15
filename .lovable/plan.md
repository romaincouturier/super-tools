# Contact du formateur dans les sondages de formation

## Résultat attendu
Sous chaque question d’un sondage de formation, afficher :

> En cas de problème ou de question, contactez le formateur Prénom Nom à l’adresse email@exemple.fr.

L’adresse email sera cliquable. Le message ne sera affiché que si la formation possède un formateur avec un nom et une adresse email.

## Mise en œuvre
- Enrichir les données publiques du sondage avec le prénom, le nom et l’email du formateur rattaché à la formation.
- Afficher ce contact sous la zone de réponse de chaque question, sans modifier le contenu des questions ni le fonctionnement de l’envoi.
- Vérifier l’affichage sur le parcours public du sondage et exécuter les contrôles du projet.

## Détails techniques
- Mettre à jour la fonction publique `get_training_survey_by_token` via une nouvelle migration, en conservant son contrôle par jeton individuel.
- Ajouter le contact au type reçu par `TrainingSurveyResponse.tsx` et rendre le texte avec un lien `mailto:`.
