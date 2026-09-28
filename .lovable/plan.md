# Relance du questionnaire de préparation

## Objectif
Corriger et moderniser l’email de relance, avec une version tutoiement et une version vouvoiement, puis envoyer les deux tests à `romain@supertilt.fr` avant tout déploiement.

## Modifications
- Remplacer les textes par défaut et les deux modèles éditables `needs_survey_reminder_tu` / `needs_survey_reminder_vous` par les formulations demandées.
- Conserver la sélection automatique selon `participants_formal_address` : `true` donne le vouvoiement, toute autre valeur donne le tutoiement.
- Garantir que `{{first_name}}` vient uniquement du participant ciblé, avec un affichage correct si le prénom manque.
- Transformer le lien du questionnaire en bouton email compatible Gmail/Outlook, puis afficher dessous un lien texte de secours.
- Échapper les données participant/formation tout en n’autorisant que le bouton généré par l’application.
- Aligner l’aperçu des réglages sur le rendu réel du bouton.

## Validation avant déploiement
- Ajouter des tests ciblés sur le choix tu/vous, le prénom du participant et le rendu bouton + lien de secours.
- Mettre à jour les deux modèles éditables en production.
- Envoyer un test de chaque version à `romain@supertilt.fr`, avec des données de démonstration isolées et sans utiliser de participante réelle.
- Attendre la validation visuelle des deux emails par l’utilisateur.

## Déploiement après validation
- Déployer uniquement la fonction concernée par cette relance.
- Vérifier son fonctionnement et l’état du projet après déploiement.
