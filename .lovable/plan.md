# Contrôle d’exhaustivité des transcripts Fireflies et Google Drive

## Ce qui est confirmé au 13 novembre 2026

Votre doute est fondé : la présence d’une fiche dans SuperTools ne garantit actuellement ni la présence du texte, ni la récupération de tout l’historique.

### Fireflies
- 286 fiches : **211 prêtes, 5 en erreur, 70 à la corbeille**.
- Parmi les 211 « prêtes », **15 n’ont aucun texte**. Le code autorise effectivement ce statut avec un texte vide.
- Les **30 réunions du dernier inventaire Fireflies**, obtenu à 09:41 UTC, ont toutes une fiche dans SuperTools. Cela ne garantit pas la présence du texte ni l’exhaustivité des réunions plus anciennes.
- La récupération courante ne vérifie que les **30 dernières réunions par défaut**, sans pagination. Les réunions plus anciennes manquées peuvent rester hors du contrôle.
- Une fiche déjà présente est ignorée, même vide ou en erreur : une nouvelle récupération ne la répare pas.
- Le traitement peut annoncer « imported » sans vérifier l’erreur d’insertion. La récupération courante peut également interpréter une erreur de réponse comme une liste vide.
- Le dernier passage affiché par `polling_cursors` reste au **2 juin 2026**, alors que des appels et des imports ont eu lieu aujourd’hui : ce témoin n’est pas entretenu par la récupération Fireflies actuelle.
- Le rattrapage historique existant recule son curseur d’une seconde avant la plus ancienne réunion d’un lot. Il peut sauter des réunions à la frontière, notamment celles ayant la même date ; ce risque est établi dans le code, mais aucun nombre d’omissions n’est encore prouvé.

### Google Drive
- **80 transcripts prêts, 2 en traitement, aucun actuellement en erreur** ; tous les prêts contiennent du texte.
- Les deux traitements concernent des enregistrements de novembre et décembre 2025 retrouvés aujourd’hui. Leur complétude finale reste à vérifier.
- La récupération parcourt maintenant les dossiers configurés et « Google Meet » récursivement, avec pagination et dédoublonnage. L’oubli des sous-dossiers constaté ce matin était réel et a déjà été corrigé.
- L’ancien outil de diagnostic `drive-list-check` ne parcourt toujours que le premier niveau : son résultat ne peut pas certifier l’exhaustivité du nouveau périmètre récursif.
- « checked » compte les transcriptions en cours vérifiées, pas toutes les vidéos découvertes. « checked 0 » ne constitue donc pas à lui seul une preuve de dossier vide ou d’inventaire complet.

### Limites de cet audit
- Aucun doublon d’identifiant n’est présent à l’intérieur de chacune des deux sources. Une même réunion disponible sur Fireflies et Drive reste deux sources distinctes, à ne pas fusionner automatiquement.
- Aucun rapprochement intégral avec tout l’historique Fireflies et tout l’arbre Drive n’a encore été exécuté. Le nombre exact de fichiers ou réunions absents est donc **non établi**.
- Les erreurs et textes vides observés ne prouvent pas que Fireflies possède un meilleur texte : il faut comparer la source avant de tenter une réparation.
- Aucun import, relancement, notification, email ou changement de production n’a été déclenché pour cet audit.

## Procédure proposée

### 1. Inventaire complet, sans import
- Lancer manuellement un contrôle authentifié réservé aux personnes habilitées au module Transcripts.
- Fireflies : parcourir toutes les pages accessibles du compte, sans fenêtre limitée aux dernières réunions ; récupérer les métadonnées et contrôler les textes des fiches suspectes. Documenter le périmètre accessible, les quotas et toute interruption.
- Drive : inventorier récursivement les mêmes racines que la récupération, avec toutes les pages et les identifiants uniques ; inclure les enregistrements anciens.
- Comparer aux fiches SuperTools en incluant les corbeilles, pour ne pas présenter une suppression volontaire comme un oubli.
- Classer chaque élément : complet, absent, en cours, bloqué, en erreur, texte vide, résumé seul, à la corbeille ou inaccessible.
- Produire un rapport daté avec totaux et liste des écarts. Un quota, un défaut d’accès ou une page non parcourue donne **« contrôle incomplet »**, jamais « tout est récupéré ».

### 2. Fiabiliser la récupération Fireflies
- Remplacer le contrôle limité aux dernières réunions par un parcours paginé reprenable, sans saut aux frontières de dates.
- Vérifier les erreurs HTTP, GraphQL et les écritures avant d’annoncer un succès.
- Ne plus marquer « prêt » un texte absent ; distinguer un résumé seul du transcript intégral.
- Examiner les fiches existantes invalides au lieu de les ignorer systématiquement ; conserver les corbeilles sans restauration automatique.
- Enregistrer séparément tentative, inventaire intégral réussi, imports réussis, erreurs et prochain curseur de reprise.
- Conserver les droits existants ; ne pas rendre les diagnostics publics ni exposer les identifiants d’accès.

### 3. Vérifier la complétude des textes
- Fireflies : comparer les phrases fournies par la source et le texte conservé, avec une empreinte du texte normalisé et un nombre de phrases ; signaler les sources sans phrases.
- Drive : vérifier les durées et, en cas de découpage, la présence et l’ordre de tous les morceaux. Une vérification impossible reste explicitement non vérifiée.
- Contrôler les deux longues vidéos actuellement en traitement jusqu’au résultat final, sans lancer une seconde transcription inutile.

### 4. Contrôle visible et rattrapage maîtrisé
- Ajouter dans Transcripts un état de contrôle par source, la date du dernier inventaire complet, les écarts et un bouton de contrôle manuel.
- Proposer une sélection explicite des éléments à récupérer ou réparer après lecture du rapport.
- Le rattrapage ne déclenche **ni Slack, ni email, ni article, ni post LinkedIn, ni analyse éditoriale automatique** ; aucune modification des leçons LMS.
- Tracer les réparations avant/après et conserver les associations existantes aux missions, formations, événements et contacts.
- **Aucune nouvelle planification dans ce lot.** Le rapport permettra de décider ensuite d’un contrôle régulier et de son intégration aux alertes quotidiennes, sur autorisation explicite.

## Tests et critères d’acceptation
- Une réunion située au-delà des 30 premières pages/positions pertinentes reste découverte ; pagination et reprise ne perdent aucune réunion à dates identiques.
- Une erreur HTTP, GraphQL ou d’insertion n’est jamais comptée comme un succès ou une source vide.
- Un transcript vide n’est pas « prêt » ; un résumé seul ne certifie pas un transcript complet.
- L’inventaire Drive découvre des vidéos imbriquées et celles au-delà d’une page ; une racine inaccessible rend le contrôle incomplet.
- Les corbeilles ne sont ni restaurées ni comptées comme absences ; répéter un rattrapage ne crée pas de doublon.
- Un morceau audio manquant ou une durée incohérente interdit la certification de complétude.
- Tester le parcours connecté : contrôle, rapport, sélection, réparation, rechargement et relecture des résultats ; vérifier l’absence de notifications et de générations secondaires.
- Livrer un bilan indiquant **combien d’éléments source ont été inventoriés, combien sont complets, combien manquent et combien ne sont pas vérifiables**, sans garantie globale si le périmètre reste incomplet.

## Détails techniques
- Réutiliser `discoverDriveVideos`, `listDriveFolder`, les contrôles de durée et les helpers de qualité existants.
- Séparer inventaire et import ; adapter `drive-list-check` et les fonctions Fireflies plutôt que dupliquer leurs mécanismes.
- Le diagnostic ne doit utiliser que les accès déjà autorisés de l’application ; si une connexion supplémentaire est nécessaire pour l’inventaire, demander son autorisation avant tout changement.
- Prévoir une persistance additive du rapport et des curseurs avec droits du module, traçabilité et inclusion aux sauvegardes ; aucune migration destructive.
- Respecter le flux page → hook → service, les règles de sécurité et les tests du projet. Déployer uniquement les fonctions effectivement modifiées, après validation.