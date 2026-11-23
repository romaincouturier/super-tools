# Roadmap

## Lecture et indexation des productions Book (2026-11-23)
- [x] Lecture des identifiants book_productions et chemins privés, repli vignette sur limite de transformation/404, réduction 1600 px, crop borné et limite full_resolution inchangée ; MCP historique et assistant intégré déployés.
- [x] Analyse IA des nouveaux visuels via file persistante, lots de trois, lease et pauses durables ; régénération privée et éditions manuelles protégées par snapshots et verrou titre. Rattrapage des images sans tags mis en file, planification horaire créée (24 passages/jour), sans email ni changement de fichiers.
- [x] Recherche MCP SDK sous les droits de l’appelant sur titre/tags/notes sans accents/casse, vignette signée ; manifeste de 25 outils extrait. Édition titre/tags/notes privée ; partage public inchangé.
- [x] 59 tests ciblés et 103 règles réussis, build OK. Analyse réelle du c2ea89b2 : titre « Les bons usages de la prospection par téléphone », 12 tags français et description de deux phrases enregistrés et relus avec Romain. Journal corrigé et testé avec destinataire obligatoire ; aucune autre production enrichie pendant cette vérification.
- [ ] Publication du nouvel outil MCP SDK et de l’écran : attend la republication par Romain. L’appel depuis Claude reste non vérifié faute de session MCP historique ; première exécution horaire et fin des 107 autres analyses non encore observées. Aucun nouveau service activé ; authentification de planification synchronisée, droits préservés.

## Revue des parcours de lecture d’images (2026-11-23)
- [x] Code relu : MCP historique et assistant intégré partagent readMediaImage ; documents/PDF scannés et analyse d’appels d’offres ne décompressent pas les pixels ; book privé/public utilise navigateur ou transforms ; imports conservent les fichiers et reçoivent les vignettes du navigateur. Recherche globale : aucun autre ImageScript/décodeur de pixels serveur trouvé ; aucun cron ni fonction SQL exécuté.
- [x] Téléchargement externe interrompu dès dépassement de 512 Kio (aperçu/crop) ou 5 Mio (original pleine résolution sans crop), délai 30 s ; URLs Storage brutes et transformées également résolues par le client existant. 34 tests ciblés, 103 règles et build OK ; mcp-server et agent-chat redéployés. Aucun original, droit, réglage ni protection publique modifié. Limites restantes : voir les deux tâches ouvertes ci-dessous.

## Lecture des grandes planches MCP (2026-11-23)
- [x] Réduction Storage signée 60 s, 1600×1600 contain qualité 80 avant décodage ; crop sur version réduite aux dimensions JPEG/PNG vérifiées, fallback local limité à 512 Kio et 1600² pixels. full_resolution sans crop conserve l’original seulement jusqu’à 5 Mio ; crop ne garantit plus la résolution originale. Droits, originaux, services et emails inchangés ; mcp-server et agent-chat déployés, manifeste parallèle 24 outils extrait, 41 tests et 103 règles OK, build OK.
- [x] Transformations réelles authentifiées Romain : c7a63837 (963 Ko) → HTTP 200, JPEG 66 951 octets / 1600×698 ; 35f19225 (3,5 Mo) → HTTP 200, JPEG 189 130 octets / 1600×1108. Ce ne sont pas des appels MCP ; crop validé seulement par tests simulés.
- [ ] Média 90636e9b (15,8 Mo) : Storage renvoie HTTP 400 « The source image resolution is too large to process ». Besoin d’une copie réduite privée préparée hors Edge ; aucun original décodé, copié ni modifié. Aperçu book existant non décodable dans le navigateur, non utilisé comme contournement.
- [ ] Six appels MCP hébergés non validés : tentatives réelles sans/avec crop refusées 401, connexion OAuth historique indisponible depuis ces outils ; session app Romain ne vaut pas session MCP. Connexion autorisée du serveur historique nécessaire, aucun secret récupéré ni droit contourné. Republier l’app pour la révision globale ; serveur historique déployé séparément.

## Publication des avis participants (2026-11-23)
- [x] Bouton « Publié sur le site » pour tous les avis publiables, y compris sans verbatim ; identité connectée obligatoire, date relue, état isolé par avis et date conservée dans la fiche formation. Droits existants : Emmanuelle par modules, Romain staff.
- [x] Génération déjà filtrée sur les avis non publiés ; trigger existant testé sur six alertes ouvertes de Romain/Emmanuelle à trois dates, clôture automatique sans toucher un autre avis. 86 tests ciblés, 3388 tests complets, typecheck, 103 règles et build OK ; clic navigateur Romain vérifié avec écriture interceptée, aucun avis réel modifié ni email. Front à publier.

## Dictée des commentaires communauté staff (2026-11-19)
- [x] Micro réservé à la session staff dans les commentaires de modération, dictée ajoutée au brouillon sans remplacer la saisie, envoi manuel bloqué pendant enregistrement/transcription ; aucun changement de leçon, droits ou email.
- [x] Neuf tests et 103 règles réussis, compilation automatique OK ; vraie transcription AssemblyAI depuis un audio test dans une communauté avec la session staff, texte ajouté au brouillon, aucun commentaire ni email envoyé. Micro et absence de débordement vérifiés sur ordinateur/mobile ; exclusion apprenant testée. Front à publier ; AGENTS.md plein, règle structurelle non ajoutée pour préserver les règles existantes.

## Parcours location Laura Schyns (2026-11-19)
- [x] Créations boutique/devis : génération automatique, envoi selon le réglage existant, réutilisation des contrats déjà envoyés ; boutons accessibles sur location bloquée. Après signature, passage en cours et effacement du blocage ; aucun cron ni droit public élargi, délégation serveur authentifiée conservée.
- [x] 23 tests et 103 règles OK, compilation automatique OK ; six fonctions déployées. Laura : contrat LOC-2026-003 généré puis envoyé depuis sa carte le 19/11 à 12:02 Paris, Resend accepté, signature pending et carte location_pending relues, traces génération/envoi présentes. Aucun autre email envoyé, aucune signature effectuée à sa place. Prochaine commande boutique non rejouée ; bouton corrigé dans l’aperçu, front à publier.

## Échec de publication (2026-11-19)
- [x] Cause confirmée : le MCP généré importe le client Cloud avec une plage de versions, résolue en dépendance auth 2.119.2 indisponible au déploiement ; figer la version déjà installée 2.110.0, sans changement de droits, données, emails ou leçons.
- [x] Version exacte propagée dans les deux lockfiles et le MCP généré ; 13 tests, 103 règles, compilation automatique et manifeste 22 outils OK ; publication demandée pour academy.supertilt.fr, résultat du déploiement non encore confirmé. Aucun service activé ni changement de sécurité.

## Téléchargements book ST-2026-0272
- [x] Téléchargements privés carte, visionneuse et album, originaux et noms conservés ; partage public inchangé.
- [x] Carte et visionneuse : original JPEG 14 978 057 octets ; album : 13 téléchargements réels, aucun échec. Mobile sans débordement ; partage public vidéo vérifié sur données simulées sans créer de vues prospect. Huit nouveaux tests, suite complète 3349 tests et 103 règles OK. Ticket résolu, note et trace relues, aucun email ; front à publier.

## Rafraîchissement Fireflies (2026-11-19)
- [x] Rétablir les 30 réunions récentes à chaque appel bouton/MCP, sans curseur historique ni plafond de trois imports ; droits, doublons et réparations manuelles préservés. Inventaire historique conservé dans le contrôle d’exhaustivité.
- [x] 17 tests et 103 règles réussis ; fireflies-backfill déployée. Deux appels successifs et 30 imports vérifiés par tests simulés, sans rattrapage réel ni email déclenché ; prochain clic réel non exécuté pour préserver les données et notifications.

## Import multiple galerie LMS (2026-11-18)
- [x] Bouton et glisser-déposer multiple ; trois uploads maximum, tri alphabétique et ajouts progressifs sans perte concurrente, bilan des échecs. Chemins images UUID pour éviter les collisions des uploads simultanés.
- [x] Six tests réussis (lot de 74, concurrence, ordre, échecs, drops et chemins distincts), 103 règles et build OK. Éditeur isolé vérifié dans le navigateur : 12 imports simulés, trois simultanés, progression et mobile sans débordement ; aucun upload réel ni modification de leçon. Viewer et format inchangés ; front à publier.

## Images multiples en veille (2026-11-17)
- [x] Images multiples en création/modification, galerie et médiathèque avec filtre Veille ; progression réelle et conservation des fichiers restants pour réessayer sans dupliquer la carte. Source media additive, droits staff inchangés, écritures tracées ; fonction upload-watch-file déployée.
- [x] Deux vrais uploads enregistrés, relus après rechargement et trouvés dans la médiathèque ; ordinateur/mobile sans débordement. Tests temporaires nettoyés avec traces ; 8 tests et 103 règles OK, aucun email ni automatisation supplémentaire. Front à publier.

## Vidéo MP4 mission (2026-11-17)
- [x] Fiche Gipal précisée : mission 6e9d24d4-ab40-4834-b745-3ad445d46147 ; même correctif appliqué aux vidéos insérées dans les pages mission.
- [x] Dépassements CPU confirmés à 20:32:46 et 20:34:05 : gros fichiers mission via transport signé/reprenable existant, droits inchangés, erreurs détaillées. Aucun changement serveur, bucket ou données.
- [x] Cinq tests et 103 règles OK, build OK ; test navigateur non abouti (galerie non atteinte), fichier MP4 original indisponible : succès réel sur Gipal non confirmé, publication du front requise.

## Progression des galeries (2026-11-17)
- [x] Pourcentage du fichier et compteur réussi/total visibles dans les galeries vides/remplies et la fenêtre d'ajout ; erreurs séparées, choix bloqués pendant l'envoi, destinations et droits inchangés.
- [x] Quatre tests de transfert/HTTP/coupure/signature et 103 règles OK, build OK ; session réelle sur formation, deux transferts simulés sans écriture : photo 25 % / 0 sur 2, vidéo 50 % / 1 sur 2, affichage ordinateur/mobile vérifié. Envoi réel non déclenché.

## Veille AO (2026-11-17)
- [x] TED API et manuel OK : ancien callback silencieux, cause HTTP historique non récupérable ; remplacé par relais géré testé 200 / anonyme 401, ancien job 84 arrêté, nouveau 97 actif à horaire inchangé. 97 nouveaux TED depuis septembre, 993 lus en quatre pages sans échec/troncature avec cinq formulations métier ajoutées.
- [x] AWS : réception OK, exclusions appliquées au digest entier et mots-clés trop étroits ; filtrage par avis corrigé, erreurs d’écriture remontées et dates Paris hiver corrigées. Sept mails depuis le 10/11 rejoués ; mail du 17/11 : 15 avis, deux retenus (ALTEMED / Grésivaudan).
- [x] PLACE : page publique ASNR lue, avis archivé ; routage mail place@ déjà existant, pas de collecte active vérifiée. Option proposée : alertes de recherches sauvegardées PLACE avec transfert dédié.
- [x] Alerte stricte >3 jours ouvrés sans nouvel import (donc pas preuve automatique de panne), récap et tâches quotidiennes, fermeture après retour de source. 67 tests / 103 règles / build OK, fonctions déployées, aucun email ni Go CRM lancé. Totaux hébergés relus ; liste vide en navigateur malgré session admin et droits CRM, lecture UI non validée, droits non élargis.
- [ ] Activer les alertes PLACE : nécessite le compte PLACE de Romain et son réglage de transfert, aucun accès disponible.

## Consommation Anthropic (2026-11-16)
- [x] Demande suivante : supprimer entièrement Autofix en conservant CI ; workflow supprimé, test de non-régression adapté et règle .github remplacée.
- [x] GitHub vérifié à 22:38 UTC : aucun Autofix actif ni en attente (in_progress/queued/waiting/pending/requested = 0) ; run 43969206005 terminé avec succès. Aucune annulation nécessaire. Deux tests de régression et 103 règles OK, CI inchangée.
- [x] Registre app depuis le 15/11 : un appel Anthropic (3144 entrée/134 sortie, estimation 0,007628 USD), provider partagé Lovable. GitHub : six Autofix non ignorés le 15/11 et deux le 16/11 ; étapes Claude vérifiées sur deux runs, modèle Opus sans borne de tours/budget. Tokens/factures GitHub non accessibles (logs 403), origine probable hors registre app.
- [x] Autofix rendu manuel uniquement, run CI échoué/main/dépôt validé avant la clé, 12 tours maximum, budget client estimé 5 USD (pas garantie de facture), durée 20 minutes ; CI et modèle conservés. Deux descriptions email Qualiopi manquantes corrigées, cause du dernier CI confirmée par annotations.
- [x] 10 tests ciblés, 103 règles et suite complète : 275 fichiers, 3305 tests OK, un saut préexistant ; compilation OK. Aucune fonction/crons/donnée/clés modifiés. Règle technique dans .github/AGENTS.md car root plein.
- [ ] Confirmer la suppression sur GitHub après synchronisation Lovable ; aucun push manuel effectué, aucun accès GitHub authentifié disponible pour modifier le dépôt distant.

## Choix de communauté formation (2026-11-16)
- [x] Choix interne/externe/aucune dans création et modification, bouton Supprimer ; communauté distincte des supports et inscriptions. Convocations, accès, démarrage et rappels live/aujourd’hui utilisent le lien interne ; alertes internes réutilisent les travaux sans retour staff, sans doublonner les groupes externes.
- [x] Trois sessions Facilitation graphique (mars 2026, novembre 2026, mars 2027) rattachées au cours interne, trois traces ; 27 anciennes tâches LinkedIn ouvertes clôturées avec trace. Aucun groupe externe dans les formations après relecture ; cinq événements PictoChallenge #83/#84/#86 (deux)/#87 conservent leur groupe 9892107, non déclaré obsolète et non modifié.
- [x] 50 tests, 103 règles, compilation OK ; session Romain réelle : valeur persistée relue, suppression/changement vérifiés sans sauvegarde supplémentaire, lien communauté et mobile sans débordement. Onze fonctions déployées ; aucun email ni cron/droit/leçon modifiés.
- [ ] Publier les nouveaux champs ; publication non demandée. Prochain email réel non déclenché pour préserver les destinataires.

## Focus quotidien audit blanc (2026-11-16)
- [x] Deux indicateurs prioritaires maximum, maintenus jusqu’à correction de toute la paire ; choix persisté dans les faits du passage automatique, nouveau modèle email focus distinct pour ne pas réutiliser un ancien rapport personnalisé.
- [x] Dernier résultat chargé dès l’ouverture, focus et défauts par dossier avec actions ; ouverture directe des indicateurs, formations, catalogue, formateurs, risques et réclamations. Anciens résultats enrichis en lecture seule uniquement si l’échantillon correspond.
- [x] 59 tests et 103 règles réussis ; session réelle Romain : deux indicateurs 21/1, résultat ouvert sans relance, cinq liens individuels vers les formations et ouverture d’une fiche, mobile sans débordement ni erreur. Aucun email ou audit déclenché ; 10 passages conservés, dernier 16/11 06:40 UTC. run-qualiopi-audit déployée, cron et droits inchangés ; règle structurelle dans _shared/AGENTS.md, root plein.
- [ ] Publier les écrans ; publication non demandée. Premier email quotidien du nouveau format et conservation après un prochain passage automatique non exécutés pendant les tests pour préserver les données réelles.

## Archives entreprise MCP (2026-11-16)
- [x] Archives administratives réutilisées : quatre outils OAuth, administrateurs uniquement, stockage privé et ajouts journalisés sans remplacement ni suppression ; Gmail connecté préexistant conservé.
- [x] Validité facultative et rappels J-30 à expiration dans digest/actions, catégories ajoutées ; migrations 0071/0072 appliquées, trois fonctions déployées, aucun cron ni email déclenché. 25 tests, 103 règles et compilation OK ; manifeste 22 outils extrait.
- [x] Ajout réel, liste et relecture octet par octet vérifiés en session Romain, document visible dans /archives et trace relue. PDF de test conservé conformément au périmètre additif ; premier essai a laissé un objet non référencé après refus du journal (recipient_email obligatoire), corrigé sans supprimer cet objet. Gmail testé par simulations, pas sur le mail Atalia. Root AGENTS au budget ; règle enregistrée dans src/lib/mcp/AGENTS.md.
- [ ] Republier front/MCP pour exposer les outils aux clients externes ; appel Claude externe non vérifié, aucun nouveau service activé (Cloud, Gmail et MCP préexistants).

## Instructions d’accès aux lieux (2026-11-16)
- [x] Migration 0070 appliquée : champ partagé par lieu et surcharge par session, droits inchangés, traces des saisies. Session Agile Tribu du 16/11 sans venue_id : héritage par adresse complète exacte unique, sans réécrire les données.
- [x] Convocations manuelles/programmées, rappel participant et aujourd’hui : insertion automatique même dans les anciens modèles, vide/visio masqués. La synthèse J-1 existante est destinée au formateur, pas aux participants ; aucun nouveau circuit créé.
- [x] Alerte dans le digest et les actions quotidiennes, aujourd’hui à J+6, annulées/visio exclues, accès admin ou responsable autorisé, lien vers /edit#access-instructions et résolution après saisie. Six fonctions déployées, aucun cron ni envoi déclenché.
- [x] 65 tests ciblés, 103 contrôles et compilation OK ; session Romain réelle consultée, saisie et confirmation testées avec écritures simulées, ordinateur/mobile vérifiés. Aucune instruction réelle inventée ni email envoyé. Architecture du resolver documentée dans _shared/AGENTS.md, root au budget existant.
- [ ] Publier les écrans de saisie et d’alertes ; publication non demandée. Les instructions réelles d’Agile Tribu restent à renseigner par l’utilisateur.

## Montants persistants devis jeux (2026-11-15)
- [x] Stockage partagé et journalisé des prix par jeu/option et frais, droits dropshipping conservés ; récupération des anciennes valeurs locales uniquement si aucune valeur partagée. Migration 0069 appliquée ; table ajoutée aux deux exports de sauvegarde, fonctions déployées sans lancement ni changement de cron.
- [x] Préremplissage application et MCP ; preview sans écriture, mémorisation MCP uniquement à la création confirmée ; aucun devis existant, catalogue ou email modifié. 15,75 € temporaires saisis dans la vraie UI et relus depuis un second navigateur vierge avec la session Romain, puis supprimés avec trace de nettoyage.
- [x] 21 tests ciblés, 103 contrôles et compilation OK ; manifeste 18 outils extrait. AGENTS.md au budget maximum, nouvelle règle structurelle non ajoutée pour préserver les règles existantes.
- [ ] Publication front/MCP et appel MCP externe : révision non publiée, aucun nouveau service activé ; Cloud et MCP préexistants conservés.

## Reprise des brouillons devis jeux (2026-11-15)
- [x] Circuit jeux sans Pennylane ; seul outil historique create_quote appelle Pennylane. ECHO existe mais prix et port absents, aucun tarif optionnel ; aucun brouillon réel créé. La cause de l’appel MCP externe n’est pas certifiée sans son retour exact.
- [x] Liste : Relire et envoyer, détail et lien quote=, confirmation explicite ; PDF/recipient relus côté serveur, idempotence fournisseur, statut Envoyé seulement après succès, éléments de commande laissés inactifs. generate-game-devis déployée ; droits dropshipping contrôlés, aucune donnée réelle ni email modifié.
- [x] 10 tests, 103 règles, compilation OK ; vraie liste relue en session Romain, brouillon deux ECHO belge et confirmation vérifiés avec écritures/envoi simulés. Manifeste 18 outils extrait ; republish requis, appel externe et réception réelle non vérifiés. AGENTS.md au budget maximum : règle structurelle non enregistrée.
- [ ] Publier front/MCP puis vérifier l’appel externe ; pour ECHO, fournir prix HT et port Belgique avant toute création réelle.

## Revue Sentry hebdomadaire (2026-11-15)
- [ ] Identifier les sept issues exactes et leurs occurrences du 7 au 14 novembre : connexion MCP acceptée mais aucun outil Sentry exposé ; journaux runtime vides et logs upload/relais indisponibles. Nécessite la liste/export du rapport Sentry.
- [x] Sept issues citées dans les échanges relues (17 à 1D), sans les présenter comme l'inventaire certifié du rapport ; correctifs existants confrontés au code pour dépôts, MKV, réactions, accueil LMS, import noCRM et relais. Cause historique upload/relais toujours inconnue ; aucune suppression globale de Sentry ni modification sans preuve.
- [x] 148 tests ciblés réussis (neuf fichiers), couvrant dépôt/réessais, refus MKV sans capture, réactions, lectures LMS, import et garde du relais. Aucun nouveau bug reproduit, aucun code métier modifié ni incident Sentry fermé. Tableau livré sur les sept références connues ; 17 (05/11) et 18 (06/11) sont antérieures à la fenêtre, leur éventuelle récurrence reste à établir.

## Suite réparation CI (2026-11-15)
- [x] Trois runs vérifiés via étapes et annotations GitHub : TypeScript et règles passent ; tests unitaires échouent sur FFmpeg absent et variables email non documentées. Journaux complets refusés (403).
- [x] FFmpeg installé explicitement dans le job ; six variables actuelles documentées, assertion conservée. Échecs locaux supplémentaires : démarrages PGlite saturés (workers plafonnés à deux, délais inchangés), import Sentry Deno sous jsdom (test upload joué sous Node, mocks et assertions conservés ; setup compatible).
- [x] TypeScript vérifié via oj sur les projets référencés, 103/103 règles, npm test : 268 fichiers et 3 229 tests passent, un saut préexistant inchangé ; compilation automatique OK. Aucun code métier, donnée, email ou droit modifié. AGENTS.md au budget maximum : règle technique non enregistrée.
- [ ] Confirmer le prochain run GitHub après synchronisation des corrections ; journaux complets inaccessibles (403), étapes et annotations des trois anciens runs vérifiées.

## Diagnostic et email audit blanc (2026-11-15)
- [x] 21 indicateurs vérifiés en lecture seule ; compte rendu livré : a = 5, 11, 12 ; b = autres concernés ; aucun indicateur entier démontré c. Trois sessions en cours faussaient les évaluations, CV ignoré, date de questionnaire utilisée comme convocation et zéro veille exploitable codé en dur.
- [x] Collecteur commun paginé : sessions terminées non annulées, vrais journaux de convocations, CV, notation des objectifs, positionnement, retours formateurs, relances et liens d’origine. Mail groupé par indicateur, majeurs d’abord, liens et estimations ; inchangé = trois priorités, pas de doublon le même jour Paris.
- [x] Vérifié connecté en Romain : 4 OK / 17 à compléter / 1 majeur selon le moteur interne ; nombre de passages inchangé, aucun email de test envoyé. Tests ciblés et 103 contrôles OK ; run-qualiopi-audit déployée, prochain passage/envoi réel non exécuté manuellement. Aucun historique, cron, droit ni leçon modifié ; front à publier. Architecture documentée dans le dossier partagé.

## Contrat et SIREN auteur (2026-11-15)
- [x] ADRESSE retire le suffixe CP/ville déjà saisi avant de composer l’adresse structurée ; modèle HTML et contrats existants inchangés.
- [x] SIREN facultatif, espaces retirés et validation 9 chiffres/Luhn dans le formulaire et avant toute écriture serveur. 28 tests réussis, 103 contrôles OK, compilation OK ; saisie/refus vérifiés au navigateur avec réponses simulées, aucun email ni donnée réelle modifiés. author-onboarding déployée ; front à publier. Recherche INSEE existante non ajoutée : option à valider séparément. AGENTS.md au budget maximum, aucune nouvelle règle structurelle ajoutée.

## Informations légales et publication (2026-11-15)
- [x] Mentions légales enregistrées dans quote_settings (lecture existante attestations/devis), SIRET et autorité conservés dans app_settings et déclarés au registre ; quatre attestations complétées, sept traces avant/après. Relu : trois brouillons sans lien, test envoyé avec lien/statut/expiration préservés. Aucun email ni lien généré.
- [x] Données relues, compilation OK et 103 règles réussies ; scan sécurité récent sans finding critique. Publication demandée pour academy.supertilt.fr ; disponibilité et clic sur l’ancien lien test non certifiés au moment de la demande.

## Retours formulaire auteur (2026-11-15)
- [x] Retours du 10 novembre complétés : nom du jeu facultatif à l'invitation, brouillon en tutoiement, commission visible, code postal/ville, SIREN obligatoire, email repris de l'invitation et verrouillé, vente/location, durée 30 jours renouvelables et aides. La fonction author-onboarding est déployée ; aucune migration, aucun email, contrat signé ou droit modifié.
- [x] 15 tests et 103 contrôles réussis, compilation OK ; formulaire testé en simulation sur ordinateur/téléphone, aide et modes de distribution visibles, formulaire incomplet sans confirmation ni soumission. Pas de soumission réelle ni de génération PDF vérifiée ; écrans à publier. AGENTS.md au budget maximum : règle structurelle non ajoutée pour préserver les règles existantes.

## Visibilité audit blanc et sources de veille (2026-11-15)
- [x] Panne de visibilité : le tableau de bord ne montait plus DailyTodoPanel ; rétabli. Audit sorti du sous-menu Formations, maintenant accessible directement. Nettoyage quotidien exclut les catégories persistantes ; réconciliation ferme anciens doublons/résolus sans effacer l’historique.
- [x] Vérifié connecté en Romain, après rechargement et sur mobile : 16 écarts distincts et les 32 sources proposées, avec nom/URL/pertinence/consignes et boutons À abonner / Écarter. RPC atomique et journalisée pour to_subscribe puis Fait → followed ; transitions testées sur Postgres isolé, aucune source réelle validée à sa place.
- [x] Bilan modifiable via le catalogue email existant, envoi Resend habituel avec BCC/signature et trace des erreurs. Passage réel 18:24 UTC : email accepté et journalisé pour romain@supertilt.fr, 1 conforme / 18 à vérifier / 3 majeurs, 20 questions. Second passage identique : aucun email et aucun doublon. Réception dans la boîte non vérifiable. Planification existante inchangée.
- [x] 32 tests ciblés et 103 règles réussis, compilation automatique OK. Deux fonctions déployées ; affichage en production nécessite publication du front. AGENTS.md au budget maximum : règle d’architecture non ajoutée pour ne pas altérer les règles existantes.

## CI GitHub (2026-11-14)
- [x] Confirmer les étapes en échec : installation npm pour les deux jobs CI, dépôt d’action inexistant pour Autofix.
- [x] Lockfile synchronisé (MCP et use-webmcp-tool absents), MCP figé en 3.4.0 et Playwright aligné en 1.62.0 ; installation stricte réussie sous Node 20 et 22. Workflows CI/Autofix/scan passés à Node 22, requis par le SDK existant.
- [x] Action officielle `anthropics/claude-code-action@v1`, token GitHub explicite et diagnostic du secret Anthropic absent ; test calendrier obsolète aligné sur la séparation date/statut, trois variables documentées, smoke test attend le rendu. Aucun mécanisme métier ou envoi modifié.
- [x] 3 177 tests unitaires réussis (un saut préexistant), 103 règles réussies, 21 tests navigateur réussis contre l'aperçu local, compilation automatique OK. Build de production et commandes TypeScript séparées non relancés manuellement.
- [ ] Confirmer la prochaine exécution GitHub ; clé `ANTHROPIC_API_KEY` et autorisation de création de PR privés non accessibles depuis cette session. Annotations GitHub lues sur les cinq commits, téléchargement des journaux complets refusé (403).

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
