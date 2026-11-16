# Focus quotidien de l’audit blanc

- L’audit automatique complet et sa planification sont conservés.
- Le mail utilise le modèle éditable `qualiopi_audit_focus`, sans reprendre l’ancien rapport complet éventuellement personnalisé.
- Deux indicateurs au maximum, majeurs puis mineurs puis à compléter. Si un membre de la paire reste en défaut, il reste seul ; la paire suivante commence seulement après résolution complète.
- Le choix est conservé dans `audit_runs.facts.auditFocus`. Les données de preuve par dossier sont stockées dans `affectedItems`, et l’échantillon dans `sample`. Aucune migration ni réécriture des passages historiques.
- L’écran charge le dernier passage et permet une relance manuelle. Pour les anciens passages, les détails courants sont lus uniquement si l’échantillon correspond, sans changer le verdict historique.

## Sécurité et vérification

Les contrôles administrateur et les droits de lecture existants sont inchangés. Aucun lien ne permet de contourner la protection de son écran. Le stockage du focus suit le circuit d’écriture et la traçabilité existants du passage d’audit. Aucun cron, email réel ou donnée d’audit historique n’a été modifié pendant les tests.

59 tests ciblés et 103 règles réussis. Vérification connectée : dernier résultat chargé, deux indicateurs, ouverture directe du détail et d’une formation, affichage mobile sans débordement. L’envoi effectif et la reprise du focus après un nouveau passage automatique restent à constater lors de la prochaine exécution normale.