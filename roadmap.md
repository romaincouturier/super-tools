# Roadmap

## Tests d’accès administrateur (2026-11-03)
- [ ] Exempter du quota interne uniquement les administrateurs vérifiés côté serveur
- [ ] Tester les droits, conserver les protections non-admin et déployer seulement send-learner-access-email

## Sentry JAVASCRIPT-REACT-14 (2026-11-03)
- [x] Identifier le quota interne atteint (3 demandes dans l’heure pour Colette), aucun échec Resend enregistré
- [x] Distinguer quota, lien et envoi ; remonter les échecs au personnel sans annoncer un email envoyé ; conserver le quota existant et les droits staff
- [x] 97 tests et 99 contrôles réussis ; seule send-learner-access-email déployée ; refus 429 réel vérifié pour Colette sans email, alerte UI vérifiée avec inscription/envoi simulés

## Progression de l’ajout groupé (2026-11-03)
- [x] Afficher l’étape en cours, la progression et le compteur pendant l’ajout et les envois
- [x] 29 tests et 99 contrôles réussis ; parcours connecté vérifié avec écritures et emails simulés, compteur 1/2 et progression 47,5 %, fermeture bloquée pendant le traitement ; aucun email réel envoyé

## Email d'accès de Colette (2026-11-03)
- [x] Diagnostiquer l'ajout groupé sans compte de connexion ni email
- [x] Corriger et tester le provisionnement réservé aux apprenants inscrits : 39 tests et 99 contrôles réussis
- [x] Déployer uniquement send-learner-access-email ; refus d'adresse non inscrite vérifié en réel
- [ ] Envoyer une fois à Colette : inscription désormais présente, quota de trois demandes atteint jusqu’au 03/11 14h57m45 Paris au plus tôt ; renvoi non effectué dans ce diagnostic pour éviter un email supplémentaire sans validation

## Envoi des documents Agirc-Arrco (2026-10-29)
- [x] Empêcher les doubles soumissions pendant la préparation et l’envoi
- [x] Vérifier les signatures formateur et bloquer les envois incomplets
- [x] Inclure les attestations dans « Tous les documents » sans emails de génération supplémentaires
- [x] 22 tests réussis ; rappel vérifié avec le compte demandeur et signatures manquantes simulées ; fonctions déployées, refus 401/400 vérifiés en réel sans email. Envoi complet réel non rejoué.

## Erreurs des fonctions et documents formation (2026-10-29)
- [x] Diagnostiquer les erreurs récentes : convention globale expirée sur AI4Product, session inter, régénération refusée sans participant
- [x] Contrôler la disponibilité de toutes les fonctions sans déclencher leurs actions : 246/246 répondent aux pré-vérifications OPTIONS
- [x] Bloquer le téléchargement de convention globale obsolète en inter : contrôle authentifié sur AI4Product et 27 tests ciblés réussis ; aucun email envoyé
- [ ] Envoi « Envoyer les documents » APICIL : aucune formation APICIL trouvée, aucune réponse HTTP d’erreur sur les envois sur 7 jours ; lien exact requis pour reproduire, ne pas rejouer un envoi à l’aveugle

## Registre des sources de veille (2026-10-27)
- [x] Données, URL canonique unique et rattachement des fiches
- [x] Onglet Sources, filtres, validation, utilité et ajout manuel
- [ ] Trois outils MCP, descriptions et nouvelle version : bloqués, aucune procédure compatible confirmée pour étendre le serveur historique sans migration implicite ; serveur inchangé (1.15.0)
- [x] 8 tests SQL/métier ; ajout, changements de statut, note persistée après rechargement, doublon et recherche vérifiés avec le compte demandeur ; vues ordinateur/mobile contrôlées ; source temporaire supprimée

## Récap quotidien (2026-10-15)
- [x] Rubrique « Missions sans prochaine action » après « Missions — Actions à traiter »
- [x] Avis missions : signaux au lieu d’emails, file des 21 convertie, écran « Avis à demander », outils MCP
- [ ] Avis formations (emails automatiques par participant) : en attente de décision

## Couverture des cours LMS (2026-10-14)
- [x] Import PNG/JPG/WebP, maximum 5 Mo, aperçu 16:9, remplacement et suppression
- [ ] Mise à jour partielle de cover_image_url depuis le MCP : bloquée, le serveur existant utilise une ancienne intégration et l’outil requis d’extraction du manifeste n’est pas disponible dans cette session ; aucune modification du serveur ni de son authentification
- [x] 38 tests ciblés réussis ; parcours authentifié import/enregistrement/rechargement/suppression vérifié sur un cours temporaire, aperçu desktop/mobile vérifié, données de test nettoyées

## Blocs LMS (2026-10-09)
- [x] Équilibrer la grille des cartes : desktop 3 colonnes (2 pour 2/4 cartes), tablette 2, mobile 1, dernière ligne centrée
- [x] Agrandir cartes/images et rendre la frise interactive dans les deux vues
- [x] Ajouter glisser-déposer souris/tactile, retrait et correction par case
- [x] Autoriser les widgets HTML/CSS sans scripts dans les iframes et le MCP
- [x] Vérifier les interactions, la sécurité et les tests sans modifier les leçons

## Emails modifiables (plan approuvé 2026-10-05)
- [x] Lot 1 : erratum e-learning, message formateur, retour dépôt, formule coachée, commentaire e-learning
- [x] Lot 2 (clients) : accès apprenant, mot de passe, démarrage session (émargement auto/live + formateur), groupe, commentaire pratique, signatures (convention, devis, location, émargement reçu) — questionnaire et émargement manuel déjà modifiables
- [x] Lot 3 : rappel et partage/modif évènement, réservation salle, alerte sans participant, devis jeux, retour formateur, commentaire mission, certificats (participant, copie, commanditaire x2) — devis formation, email CRM et certificat commanditaire manuel déjà rédigés/modifiables
- [x] Lot 4 (internes) : erreur formulaire, connexion, support, tickets archivés, conventions, session complète, réponse questionnaire, veille, rappel d'action, contenu, dépôt formateur, collaborateur
- [x] Règle [075] + contrôle check-rules.sh (après lot 4)
- [x] À la fin (après lot 4) : envoyer à romain un email de test pour chacun des ~40 emails migrés
- Attente : validation du rendu des 53 emails de test par l'utilisateur

## MCP Picto-Dico (2026-10-09)
- [x] Ajouter l'outil `check_picto_entries` (vérif backlog pictodico_words)
- [x] Vérifier que le déploiement mcp-server sert bien les 4 outils LMS (tools/list)

- [x] Location : relances signature J+3/J+7, badge À expédier, bouton Jeu expédié
- [x] Relance questionnaire : prénom, bouton, apostrophes corrigés

- [ ] Avis/témoignages formations : google_review, evaluation_reminder et video_testimonial à 1 jour d intervalle saturent les participants (cas Abobkar Benabdellaoui, refus explicite). A intégrer à la refonte en signaux.
- [x] CRM Corse 829e60ef : créer mission liée
- [x] MCP mark_opportunity_won : create_mission par défaut pour missions + création si déjà WON sans mission
- [x] Audit cartes WON mission sans mission liée

## Évaluations à froid (2026-11-02)
- [x] Deux envois passés annulés ; seuil partagé planification/envoi/relance déployé ; 16 tests réussis et refus authentifié vérifié en ligne sans email
- [x] Doublons commanditaire corrigés + protection en base
- [x] Session sans email commanditaire : raison enregistrée, affichée, envoi auto dès l'email connu (AI4Product : commanditaire unique des participants)
- [x] Classes virtuelles : un envoi par commanditaire distinct
- [x] Un seul jeton par destinataire et session
- [x] Relance unique à 3 jours ouvrés, annulée si réponse
- [x] Questionnaire participant natif à 30 jours ouvrés
- [x] Suivi sur la fiche formation et la page Évaluations, action d'amélioration, analyse IA
