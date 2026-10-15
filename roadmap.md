# Roadmap

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
