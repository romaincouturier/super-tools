# Évaluation à froid : ce qui manque (participant + commanditaire, envoyée, relancée, tracée)

Constat vérifié dans le code et les données le 02/11/2026. Rien n'est modifié tant que ce plan n'est pas approuvé.

## Commanditaire
1. **Corriger le doublon** : la vérification « déjà planifié » des sessions intra ne marche pas (le contrôle sur « pas de participant » ne trouve jamais rien), donc un 2e envoi du mail de remerciement planifie une 2e évaluation (cas Acoss, 3 et 12 mai). Ajouter aussi une protection contre les doublons en base.
2. **Session sans email de commanditaire** : ne plus réessayer en silence tous les jours. Enregistrer la raison, l'afficher sur la fiche formation et dans les actions du jour, puis envoyer automatiquement dès que l'email est saisi (cas AI4Product).
3. **Classer correctement les sessions** : les classes virtuelles passent aujourd'hui dans le cas intra (un seul commanditaire). Les traiter comme les inter quand les participants ont chacun leur commanditaire.
4. **Créer le jeton une seule fois** : aujourd'hui, une ligne d'évaluation est créée à chaque tentative, même quand l'envoi échoue.
5. **Relance** : relancer une fois après N jours ouvrés (délai réglable) si rien n'est soumis, et l'annuler si une réponse arrive.
6. **Affichage** : section « Évaluation à froid » sur la fiche formation (envoyée / ouverte / soumise / réponses), plus un tableau récapitulatif dans Qualité.

## Participant
7. **Questionnaire à froid participant natif** : lien avec jeton, sur le modèle commanditaire, pour toutes les sessions (inter, intra, classe virtuelle, e-learning), au délai réglable. Questions reprises du Google Form actuel (à me fournir).
8. **Même relance, même suivi et même affichage** que pour le commanditaire.

## Traçabilité et Qualiopi
9. Rattacher chaque réponse à la session, au participant et à la formation du catalogue, et l'intégrer à l'analyse des évaluations et au plan d'amélioration (Ind. 30-32).
10. **Historique** : les 22 évaluations commanditaire envoyées avant le 29/09 pointaient vers le Google Form. Leurs réponses ne sont pas dans SuperTools : prévoir un import ponctuel.

## Questions ouvertes
- Délai de l'évaluation à froid participant et délai de relance.
- Faut-il relancer AI4Product à la main une fois l'email du commanditaire connu ?
