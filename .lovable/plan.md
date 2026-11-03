# Cours « hors vente supertilt.fr »

## Situation actuelle
Le récap du 03/11 signale 6 cours :
- Les fondamentaux de l'Agilité : Produit Woo manquant
- Icebreakers à la carte : Aucune session
- Icebreakers mode d'emploi : Aucune session
- MasterClass Animer des réunions à distance : Aucune session
- Développer sa posture de manager : Aucune session
- La météo intérieure : Aucune session

Les alertes sont recréées chaque jour sans que les anciennes se ferment : 708 actions de cette catégorie restent ouvertes, dont environ 125 chacune pour Agilité, Icebreakers à la carte, MasterClass et Posture de manager. On y trouve aussi d'anciens noms (« AI4Product », « Agilité », « Icebreaker mode d'emploi », « Gagner en efficacité… »).

## Solution proposée
1. Ajouter à chaque cours une case **« Hors vente supertilt.fr »**, décochée par défaut.
2. Emplacement : **LMS → cours → Paramètres du cours**, juste à côté du type d'accès. Le badge d'état d'intégration du cours affiche alors « Hors vente supertilt.fr » au lieu de l'erreur.
3. Les cours cochés sont exclus du diagnostic, comme les brouillons et les cours intra aujourd'hui : plus aucune alerte dans le récap, l'écran Intégrations e-learning et les actions quotidiennes.
4. Les actions déjà ouvertes pour un cours coché se ferment automatiquement (marquées terminées automatiquement) au prochain passage quotidien.
5. Nettoyage ponctuel : fermer aussi les doublons des jours précédents et les alertes visant des cours qui ne posent plus problème. Seule l'alerte du jour reste par cours encore concerné.
6. Après validation, je coche la case pour « Les fondamentaux de l'Agilité » et « Icebreakers à la carte ». Pour les 4 autres cours, dites-moi lesquels sont aussi hors vente.

## Détails techniques
- Migration additive : `lms_courses.excluded_from_shop_integration boolean not null default false`. Pas de nouvelle table, donc pas de nouvelle politique d'accès.
- Filtre ajouté dans `_shared/daily-data-fetchers.ts` (`fetchElearningIntegrationIssues`) et `src/lib/elearningIntegration.ts`, avec un test par règle.
- Dans `generate-daily-actions`, auto-complétion des actions `elearning_integration` dont le cours n'est plus en anomalie, pour arrêter l'accumulation.
- Redéploiement de `generate-daily-actions`, `process-logistics-reminders` et `process-daily-summary`.
- Le champ est exposé dans le service/hook des paramètres du cours (pas d'appel direct dans le composant).

## Question
Parmi Icebreakers mode d'emploi, MasterClass, Posture de manager et Météo intérieure, lesquels marquer aussi « hors vente » ?
