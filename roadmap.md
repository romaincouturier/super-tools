# Roadmap

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
- [ ] Ajouter l'outil `check_picto_entries` (vérif backlog pictodico_words)
- [ ] Vérifier que le déploiement mcp-server sert bien les 4 outils LMS (tools/list)
