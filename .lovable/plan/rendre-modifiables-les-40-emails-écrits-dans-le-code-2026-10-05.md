# Rendre modifiables les ~40 emails écrits dans le code

## Objectif
Chaque email envoyé automatiquement doit avoir son texte (objet + contenu) modifiable dans Paramètres > Emails, comme les modèles existants. Le texte actuel devient le modèle par défaut : aucun changement visible pour les destinataires tant que personne ne modifie le modèle.

## Emails concernés (39)

**Clients / participants / apprenants**
- Accès apprenant (création, changement d'adresse), réinitialisation mot de passe
- Démarrage de session, erratum e-learning, mise en relation de groupe
- Rappels d'événements, rappels logistiques, rappels de liste des participants
- Envoi de questionnaire, réponse à un dépôt, message LMS, commentaire LMS, commentaire de pratique
- Devis (formation, jeu), demande de réservation de salle, partage et mise à jour d'événement
- Confirmations de signature : émargement, convention, devis, contrat de location
- Certificats, évaluation formateur, formule coachée, email CRM, commentaires de page mission

**Alertes internes à l'équipe**
- Erreur de formulaire, tentative de connexion, ticket support, tickets archivés
- Statut des conventions, session complète, réponse à un questionnaire, tag de veille
- Rappel d'action, notification de contenu, dépôt à corriger (formateur), arrivée d'un collaborateur

## Déroulé
Par lots d'environ 10 emails, clients d'abord :
1. Ajouter chaque email au catalogue des modèles, avec ses variables documentées et la mention « Envoyé quand… ».
2. Faire lire le modèle par l'envoi, avec le texte actuel en secours.
3. Ajouter une rubrique « Alertes internes » dans Paramètres > Emails.
4. Envoyer un email de test par modèle à ton adresse avant de mettre en ligne chaque lot.

## Règles
- Les éléments techniques restent protégés : boutons, liens tokenisés, tableaux de données, pièces jointes. Ils apparaissent dans le modèle sous forme de variable (ex. `{{bouton_acces}}`), pas en HTML modifiable.
- Tu/vous proposés seulement pour les emails clients ; alertes internes en version unique.
- Nouvelle règle de contrôle : un nouvel envoi d'email sans modèle éditable est bloqué.

## Détails techniques
- Catalogue : `DEFAULT_TEMPLATES` (`settingsConstants.ts`), nouvelle valeur `timing: "internal"`.
- Lecture serveur : helper partagé existant de `_shared/email-helpers.ts` (template_type puis défaut), `processTemplate` + `templateTextToHtml`, CTA générés côté serveur.
- Aucune migration : les modèles ne sont écrits en base qu'à la première modification.
- Règle [075] dans `IMPROVEMENTS.md` + check dans `scripts/check-rules.sh` (fonction appelant `sendEmail` sans lecture `email_templates`, liste d'exemptions explicite).
