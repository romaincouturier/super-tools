# Roadmap

## MCP devis jeux (2026-11-14)
- [x] Ajouter `list_games` et `create_game_quote` au connecteur MCP actuel, avec droits dropshipping, preview par défaut et écriture uniquement sur `confirm=true`.
- [x] Créer le brouillon dans le circuit `woocommerce_orders` / `order_items` / `activity_logs`, avec numérotation DV, PDF existant et commentaire CRM, sans email, Slack, vente ni alerte de commande ; brouillons exclus du kanban, des ventes et des commandes actives.
- [x] Neuf tests ciblés, compilation et 103 contrôles réussis ; manifeste de 18 outils extrait. Preview réel CLPS : bonne fiche et bon jeu, mais prix et frais de port catalogue ECHO absents, donc aucun montant inventé et aucune écriture (0 commande, 0 journal).
- [ ] Republier l’application pour exposer cette révision MCP à Claude. Pour créer ensuite ce devis ECHO, fournir explicitement `unit_price` et `shipping_fee` ou compléter le catalogue.

## Formats dépôt apprenant, Sentry 1D (2026-11-14)
- [x] MKV refusé à la sélection pour ajout et remplacement, même MIME absent ou trompeur ; extensions affichées selon la leçon : JPG/JPEG, PNG, PDF, MP4/WebM/MOV. Refus inline avec conseil MP4, sans toastError/Sentry ni upload.
- [x] 32 tests ciblés réussis ; aucune leçon, restriction stockage ou fonction modifiée. Front à publier, build OK ; contrôle [065] préexistant hors périmètre.

## Connexion Marie Leurent (2026-11-14)
- [x] Compte confirmé créé le 13/11 à 22:54 UTC, mot de passe présent/prouvé, inscription reliée par email ; autre adresse sans compte. Journaux auth/Edge absents pour cette fenêtre, outils Sentry non exposés.
- [x] Doublons guidés par boutons connexion/récupération avec email prérempli ; après création, session actualisée et formations existantes ouvertes sans passage forcé au catalogue gratuit. create-academy-account déployée : aucune réécriture du profil sur doublon, droits/configuration auth inchangés.
- [x] 68 tests réussis, dont le handler serveur en doublon sans aucune écriture ; parcours navigateur doublon/récupération simulé vérifié. Aucun compte, mot de passe, email ni leçon modifié. Liens actuels sur academy.supertilt.fr : /connexion ou /connexion/reinitialisation ; ancien mail de juillet /apprenant/connexion redirigé vers /connexion. Build OK, contrôle [065] préexistant seul en échec. Front à publier ; incident historique exact non démontré faute de logs/Sentry, session réelle de Marie non utilisée.

## Dépôt apprenant, Sentry 1C (2026-11-13)
- [x] upload-lms-content reçoit le multipart complet puis l'envoie au stockage ; CORS réel OPTIONS 200 avec tous les headers client. Bucket sans limite propre ni restriction MIME ; formulaire 50 Mio par défaut, pas de timeout client explicite. Aucun log disponible sur 15:15–15:35 UTC, même toutes sources confondues ; cause historique non démontrée.
- [x] Messages HTTP détaillés et erreur de transport sans attribution certaine au réseau ; 3 tentatives (1 puis 3 s), verrouillage pendant tout l'upload et sélection/commentaire conservés après échec. 28 tests réussis, build OK ; aucun email, donnée ou leçon modifiés, front à publier. La sélection n'est pas persistée après rechargement/fermeture.
- [ ] Événement Sentry détaillé non accessible : connexion MCP annoncée réussie mais aucun outil Sentry exposé dans cette session. Cause exacte et fichier de l'incident impossibles à certifier avec les seuls éléments disponibles.

## Lecture MCP des planches du book (2026-11-13)
- [x] Cause : bucket book-productions privé avec anciennes URLs publiques ; téléchargement SDK sans changement de droits, réduction à 1600 pixels et pleine résolution. mcp-server et agent-chat déployés.
- [x] Recadrage en pourcentages avant réduction ; 31 tests réussis. Source réelle de 14 666 498 octets : aperçu 1600×1109, zone 10 % en pleine résolution 1764×1223. Limite source 15 Mio, sortie 5 Mio ; aucun original modifié ni email envoyé.
- [x] Média e963d32f-1968-4e5a-a966-f077e81b208b lu avec la session du demandeur et lectures journalisées : réduit 119 855 octets, original identique 175 410 octets (874×1240), crop 438×620 vérifié visuellement. Test du helper réel, pas un appel externe Claude sur le serveur hébergé ; mémoire/temps des grandes planches sur Edge non certifiés. Build OK ; contrôle [065] préexistant hors périmètre.

## Contrôle d’exhaustivité des transcripts (2026-11-13)
- [x] Inventaires paginés/récursifs persistants avec accès du module, export et 19 tests réussis (dont droits sur Postgres). Fireflies accessible : 187 réunions, 130 textes conformes, 19 invalides/vides, 37 corbeilles, 1 absente ; 100 fiches locales hors source accessible, pas déclarées perdues.
- [x] Récupération Fireflies paginée reprenable ; erreurs HTTP/GraphQL/écritures vérifiées, textes absents non prêts, ancien rattrapage remplacé par sélection manuelle. Réparation réelle de la réunion manquante Formation Intelligence collective (1/2) : 146 phrases importées sans notification/génération et trace avant/après ; 131 textes conformes après réparation. Pas de rattrapage massif.
- [x] Écran Contrôle vérifié connecté et sur mobile, résultats relus après rechargement ; Drive : 114 vidéos dans 16 dossiers, 79 complètes, 33 absentes, 2 en traitement, 1 fiche locale hors arbre ; fonctions concernées déployées et nouvelles tables incluses aux sauvegardes. Aucune nouvelle planification ni leçon modifiée. Front à publier ; contrôle [065] préexistant hors périmètre.
- [ ] Deux longues vidéos Drive sont toujours en traitement chez le prestataire ; résultat final indisponible au dernier contrôle, sans seconde transcription lancée.

## Génération de contenus depuis un transcript (2026-11-13)
- [x] Cause confirmée : appel d'outil forcé refusé par le modèle ; sélection automatique avec consigne explicite, validation du nom de l'outil, modèle/réglages/droits inchangés.
- [x] Quatre tests réussis (article, LinkedIn, réponses sans outil attendu) ; seule generate-transcript-content déployée. Test réel connecté : quatre propositions LinkedIn créées sur PictoChallenge #88, relues après rechargement, aucun envoi vers le board ni email. Build OK ; contrôle global [065] préexistant en échec hors périmètre.

## Transcription Google Meet Drive (2026-11-13)
- [x] Racines configurées conservées et Google Meet ajouté ; récursion, pagination et dédoublonnage par ID ; refresh authentifié retrouve cinq fichiers oubliés, quatre prêts immédiatement.
- [x] Limites documentées : upload 2,2 Go, transcription 5 Go/10 h ; MP4 AAC volumineux extraits en morceaux de 45 min, stockage des jobs/textes ordonnés dans metadata, contrôle de durée et erreurs Sentry ; traitements bloqués >24 h signalés, pas de relance infinie des erreurs.
- [x] Servier : 2 368 148 140 octets, Drive 12 269,874 s, AssemblyAI 12 270 s, dernière parole 12 266,033 s, 136 973 caractères sauvegardés ; visible connecté. Extraction réelle du premier morceau : 44 086 293 octets / 2 700 s / cinq morceaux, sans seconde transcription. 41 tests réussis ; trois fonctions déployées. Assemblage multi-jobs vérifié par test, pas de seconde facturation complète Servier ; contrôle global [065] préexistant hors périmètre.

## Reprise des sauvegardes Drive (2026-11-12)
- [x] Ancienne planification 18 désactivée ; relais backup-managed-tick déployé et planification gérée 96 créée avec la cadence et la fenêtre d'origine. Moteur et autres automatismes inchangés.
- [x] Appel automatique réel accepté à 20:58 UTC : run du 12 novembre créé, phase db en cours ; refus anonyme 401 vérifié et 35 tests réussis.
- [ ] Résultat final base/fichiers en attente du traitement asynchrone ; la fenêtre actuelle s'arrête à 21:00 UTC et reprend à 05:00 UTC. Contrôle préexistant [065] hors périmètre.

## Portes de connexion (2026-11-12)
- [x] Connexion administrateur restant sur `/auth` corrigée : session actualisée puis navigation explicite. Régression reproduite avant correction ; 29 tests réussis et build OK. Navigateur : réponse de connexion simulée avec vraie session admin, tableau de bord affiché ; saisie du vrai mot de passe non testée.
- [x] Exception demandée : « Se connecter » ouvre l'espace apprenant si déjà connecté ; sinon formulaire. `/auth` conserve son formulaire et l'accueil reste public. Clic vérifié avec le compte demandeur.
- [x] Back-office toujours gardé par `RequireStaff` (apprenant et non connecté refusés), testé ; 25 tests ciblés réussis et build OK ; formulaire `/auth` vérifié connecté.
- [ ] Publication du front nécessaire pour academy.supertilt.fr ; contrôle préexistant [065] en échec dans TrainingTimeline.tsx, hors périmètre.


## Sessions sans tarif associé (2026-11-12)
- [x] Détecter les sessions inter datées à venir sans formule boutique associée ; une alerte par session, réservée aux administrateurs et au responsable autorisé ; les associations partielles ne sont pas traitées comme un manque.
- [x] Résolution après association testée ; deux fonctions déployées, génération exécutée et quatre alertes sans doublon relues en base ; aucun email ni modification des sessions.
- [x] Tableau de bord connecté : quatre alertes visibles et clic vers le 18 mars vérifié ; 46 tests réussis et build OK. Contrôle préexistant [065] en échec dans TrainingTimeline.tsx, hors périmètre ; affichage publié après publication du front.

## Assignation des actions projets (2026-11-11)
- [x] Résolution partagée nom/prénom nom/email, canonisation UI/MCP et alertes explicites pour assignés inconnus ; module projets transverses seul inclus dans les destinataires.
- [x] Canonisation idempotente exécutée : cinq assignations déjà canoniques, aucune carte modifiée ; seule action quotidienne LinkedIn du 11 novembre réattribuée d’Emmanuelle à Romain avec trace avant/après, historique conservé.
- [x] 27 tests ciblés et 103 contrôles réussis ; quatre fonctions consommatrices déployées sans invocation d’envoi ; carte et menu vérifiés connectés, lecture quotidienne réelle retourne l’action de Romain. L’ancien écran TODO n’est plus routé ; publication nécessaire pour les changements du formulaire.

## Simulation noCRM (09/11/2026)
- [x] Convertisseur Europe/Paris partagé : 74 000 créations supprimées, mesure locale 5 418 → 468 ms ; 14 tests réussis.
- [x] Colonnes historiques Gagné/Perdu reconnues sans les désarchiver ; nocrm-import déployée, simulation réelle terminée et rapport affiché : 1 955 fiches, 15 577 commentaires/activités, aucune fiche importée.

## Couvertures fournies (09/11/2026)
- [x] 14 PNG distincts, 21 uploads dans lms-content aux chemins images/course_id/cover-uuid.png ; 21 cover_image_url renseignées et écritures tracées.
- [x] 21 URLs HTTP 200 et octets identiques aux fichiers fournis ; trois couvertures préexistantes intactes, empreinte des autres champs identique (hors updated_at géré par trigger).
- [x] Cadrage 16:9 comparé pour les 14 visuels, sujets principaux conservés ; accueil Facilitation graphique vérifié connecté en 1280 et 375 px, aucun code ni contenu de leçon modifié ; liste CSV livrée.

## Décisions du 09/11/2026
- [x] Script validé appliqué : 22 lignes manquantes ajoutées (8 true, 14 false), 7 existantes préservées ; 22 écritures tracées, aucun email ni changement de mot de passe.
- [x] Workflow présentiel/mixte et post-formation conservé ; rappel financeur à 10 jours ouvrés validé le 09/11, ancienne consigne J+45 remplacée sans changement du code.
- [x] APICIL : sujet clos par Romain le 09/11, aucune action ni nouvel envoi.
- [x] Migration MCP expliquée : SDK/endpoint/auth, distincte du schéma training_transcripts ; couverture déjà implémentée dans le code actuel, disponibilité hébergée non vérifiée.

## Dictée CRM et rattachement (2026-11-09)
- [x] Relais automatique par segments de cinq minutes, transcription ordonnée et bouton Arrêter disponible ; 8 tests et 103 contrôles réussis, vrais segments décodés sur navigateur ordinateur/mobile ; transfert audio staff/propriétaire déployé. Rendez-vous réel et verrouillage mobile non vérifiés.
- [x] Diagnostiquer les séparateurs vides : anciens marqueurs sans injection ; 53 cartes / 85 marqueurs ne prouvent pas tous une perte, certains textes sont présents sous les marqueurs
- [x] Conservation audio et rattachement avant transcription, erreurs visibles ; dossier MCP retrouve les dictées liées et leur verbatim même si seul le descriptif de la carte nomme le client ; 19 tests ciblés réussis, MCP déployé
- [x] Les quatre dictées MSP d’Ecully sont déjà liées, avec un cinquième transcript Fireflies ; 38 dictées CRM / zéro orpheline, aucune écriture rétroactive nécessaire. Carte ouverte avec le compte demandeur, cinq transcripts visibles et texte consultable
- [x] Aucun audio trouvé dans le stockage entre 09:30 et 11:10 UTC le 09/11 ; note 12:00 Paris et début manquant non récupérables depuis les éléments retrouvés, aucune retranscription lancée

## Modules LMS et transcripts formations (2026-11-09)
- [x] Neuf outils sur un endpoint parallèle, manifeste extrait ; OAuth activé, ancien serveur conservé, aucune leçon modifiée ni email envoyé.
- [x] Liaison training_transcripts et affichage formation, droits staff et traçabilité ; modules atomiques, couvertures/sources tracées ; tests SQL et navigateur connectés réussis.
- [ ] Publication puis nouvelle connexion OAuth nécessaires pour vérifier un appel externe complet ; endpoint géré non déployé avant publication.

## Règlement intérieur éditable (2026-11-05)
- [x] Migration initiale publiée : huit articles identiques à l’ancien PDF ; téléchargement réel dans Formation et Documents avec le compte demandeur, 14 tests et 103 contrôles réussis
- [x] Ancien fichier supprimé du stockage et lien retiré des archives : ancienne URL répond 400 sans PDF, aucun réglage ne le référence
- [x] Copie de sauvegarde privée Google Drive de l’ancien PDF : hors suite selon décision de Romain du 09/11 ; aucune sauvegarde modifiée, règlement diffusé depuis les paramètres
- [x] Édition Markdown avec titres/gras/listes, brouillon sauvegardé et aperçu PDF SuperTilt
- [x] Publication explicite, archivage atomique des PDF précédents et protection contre les éditions concurrentes ; droits administrateur conservés
- [x] Texte du PDF actuel repris en brouillon ; sauvegarde/rechargement réels vérifiés, confirmation annulée, PDF diffusé inchangé ; 12 tests et 103 contrôles réussis, aucune publication réelle ni email

## Marque apprenant (2026-11-05)
- [x] Mail de redemande « Créez votre mot de passe SuperTilt Academy », sujets d’accès et bandeau de connexion renommés ; aucun modèle personnalisé contenant SuperTools trouvé en base
- [x] 75 tests et 103 contrôles réussis ; connexion vérifiée avec bandeau simulé, compilation OK ; six fonctions d’envoi concernées déployées, aucun email envoyé

## Lives, tickets et notifications (2026-11-05)
- [x] Lecture seule : Marie a une inscription session de novembre ; RPC et calendrier retournent novembre/décembre aujourd’hui, sélection globale par cours et non par inscription ; 53 inscrits LMS potentiellement concernés par cette sélection
- [x] Numérotation corrigée en base le 04/11 à 17:50 UTC : ancien code reproduit avec 24 collisions/30, actuel vérifié avec 30 transactions sans collision ; 4 tests conservés ; aucun ticket ni contenu de Myriam retrouvé
- [x] Objets/intros internes clarifiés avec nom du cours, deux fonctions redéployées ; 5 tests Vitest et 4 tests Deno passés, 101 contrôles OK ; aucun email de test envoyé

## Retour des jeux loués (2026-11-04)
- [x] Bouton « Jeu revenu » avec confirmation, date de retour dédiée et clôture même avant échéance ; date contractuelle conservée
- [x] 3 tests SQL et 99 contrôles passés ; parcours connecté vérifié avec écriture simulée, aucune commande réelle modifiée

## Devis de jeux (2026-11-04)
- [x] Proposer les contacts des opportunités CRM ouvertes comme commanditaires et conserver le rattachement du devis
- [x] Mémoriser immédiatement les prix unitaires par jeu/tarif et les frais de port/dossier dans le navigateur existant, puis les recharger sans modifier le catalogue
- [x] Six tests et 99 contrôles réussis ; contact réel, sélection répétée et rechargement vérifiés en session connectée, aucun devis envoyé

## Statistiques des opportunités (2026-11-04)
- [x] Catégories exclusives par statut et colonne ; état du jour prioritaire sur l’historique incomplet, dates de clôture selon le statut
- [x] Détails ordonnés sur les deux graphiques ; 35 tests et 99 contrôles réussis, graphiques connectés vérifiés et totaux gagnés/perdus comparés aux opportunités réelles

## Création de session permanente (2026-11-04)
- [x] Ajouter Solo depuis la session, hériter des valeurs du catalogue et conserver le lien de la formule à l’enregistrement
- [x] Cours disponibles en premier, tri alphabétique par groupe et pictogramme des cours associés ; 5 tests et 99 contrôles réussis, création réelle Solo temporaire vérifiée puis nettoyée ; aucune session créée

## Tableaux des formations (2026-11-04)
- [x] Date retirée des permanentes, Lieu conservé, tris indépendants actifs ; parcours connecté ordinateur/mobile vérifié, 8 tests et 99 contrôles réussis

## Mails d'accès selon l'état du compte (2026-11-04)
- [x] Règle serveur : sans mot de passe prouvé (ou sans ligne) -> « Créez votre mot de passe » ; sinon « Votre accès à la formation est ouvert » avec lien direct
- [x] Modèle learner_course_access, nom de formation à l'ajout unitaire, bilan de l'import en lot, MCP aligné
- [x] Cause racine : inscription Academy et connexions par mot de passe enregistrent le mot de passe
- [x] Ancienne fonction send-elearning-access retirée
- [x] Correction des 29 comptes validée et appliquée le 09/11 : 22 ajouts (8 true, 14 false), 7 lignes existantes préservées ; journalisation par compte, aucun email
- [x] Rattrapage : quatre emails envoyés après accord et vérification ; Delphine exclue, mot de passe désormais défini
- [x] Présentiel/mixte : mécanisme actuel conservé selon décision du 09/11 ; workflow à rappeler, pas de refonte

## Identité à la création du mot de passe (2026-11-03)
- [x] Préremplir et enregistrer prénom et nom obligatoires après confirmation explicite du lien, sans consommation à l’ouverture
- [x] 35 tests et 99 contrôles réussis ; chargement authentifié réel et blocage du prénom vide vérifiés ; sauvegarde testée avec écritures simulées, aucun mot de passe réel modifié

## Tests d’accès administrateur (2026-11-03)
- [x] Exempter du quota interne uniquement les administrateurs vérifiés côté serveur
- [x] 36 tests et 99 contrôles réussis ; 12 envois administrateur simulés, quota non-admin conservé ; seule send-learner-access-email déployée, tentative d’usurpation anonyme refusée 403 en réel ; aucun email réel envoyé

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
- [x] Colette : sujet clos par Romain le 09/11 ; aucun renvoi à effectuer

## Envoi des documents Agirc-Arrco (2026-10-29)
- [x] Empêcher les doubles soumissions pendant la préparation et l’envoi
- [x] Vérifier les signatures formateur et bloquer les envois incomplets
- [x] Inclure les attestations dans « Tous les documents » sans emails de génération supplémentaires
- [x] 22 tests réussis ; rappel vérifié avec le compte demandeur et signatures manquantes simulées ; fonctions déployées, refus 401/400 vérifiés en réel sans email. Envoi complet réel non rejoué.

## Erreurs des fonctions et documents formation (2026-10-29)
- [x] Diagnostiquer les erreurs récentes : convention globale expirée sur AI4Product, session inter, régénération refusée sans participant
- [x] Contrôler la disponibilité de toutes les fonctions sans déclencher leurs actions : 246/246 répondent aux pré-vérifications OPTIONS
- [x] Bloquer le téléchargement de convention globale obsolète en inter : contrôle authentifié sur AI4Product et 27 tests ciblés réussis ; aucun email envoyé
- [x] APICIL identifiée le 09/11 : AI4Product 724bba99-48af-46b5-b359-23db722e12d6, quatre participants ; envoi émargements enregistré le 11/10, email commanditaire absent pour Jean-Michel ; erreur générale non reproduite, aucun envoi rejoué

## Registre des sources de veille (2026-10-27)
- [x] Données, URL canonique unique et rattachement des fiches
- [x] Onglet Sources, filtres, validation, utilité et ajout manuel
- [x] Trois outils de veille ajoutés au connecteur parallèle ; serveur historique inchangé, publication requise pour les utiliser.
- [x] 8 tests SQL/métier ; ajout, changements de statut, note persistée après rechargement, doublon et recherche vérifiés avec le compte demandeur ; vues ordinateur/mobile contrôlées ; source temporaire supprimée

## Récap quotidien (2026-10-15)
- [x] Rubrique « Missions sans prochaine action » après « Missions — Actions à traiter »
- [x] Avis missions : signaux au lieu d’emails, file des 21 convertie, écran « Avis à demander », outils MCP
- [x] Avis formations : mécanisme actuel conservé selon décision du 09/11, aucune refonte ni envoi déclenché

## Couverture des cours LMS (2026-10-14)
- [x] Import PNG/JPG/WebP, maximum 5 Mo, aperçu 16:9, remplacement et suppression
- [x] Mise à jour partielle de cover_image_url : update_lms_course et validation déjà présents dans le code vérifié le 09/11 ; ancien blocage périmé pour ce champ, révision hébergée non vérifiée
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

- [x] Avis/témoignages formations : mécanisme actuel conservé selon décision du 09/11, aucune refonte en signaux.
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
- [x] MCP update_training : notes, objectifs, prérequis, programme, copie catalogue
