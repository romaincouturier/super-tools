# Amélioration continue Qualiopi (ind. 30-32) au fil de l'eau

Objectif : remplacer la revue mensuelle et le Google Sheet. Chaque signal devient une action datée de catégorie « Qualité » dans les actions quotidiennes et dans le mail existant. Aucun email automatique aux clients ou aux participants.

## 1. Données (réutiliser l'existant, une seule table nouvelle)

Nouvelle table `quality_feedback_items` : la file des retours, une ligne par signal.
- `source_type` (hot_eval, sponsor_cold, participant_cold, stakeholder, trainer, reclamation), `source_id`, `training_id`, `participant_name`, `received_at`
- `trigger_reasons` (liste : note_basse, non_recommande, booleen_qualite_false, texte_amelioration), `excerpt` (le texte à lire)
- `decision` (pending, improvement_created, linked, no_action), `improvement_id`, `decision_reason`, `decided_at`, `decided_by`
- Contrainte d'unicité sur (`source_type`, `source_id`) : jamais de doublon.

Ajouts sur `improvements` (colonnes facultatives) :
- `effect_observed` (texte) et `effect_checked_at` (date) : mesure d'efficacité attendue par l'indicateur 32.
- Les 5 améliorations « pending » restent telles quelles ; seules des actions sont créées.

`evaluation_analyses` : utilisée telle quelle, plus `validated_at` et `validated_by`.

`daily_actions` : inchangée. Catégorie `qualite`, `entity_type` = feedback, reclamation, improvement, training_collect, analysis.

Droits : accès au module « ameliorations » existant (`user_module_access` / `is_admin()`).

## 2. Règles de génération (dans `generate-daily-actions`, cron de 07h00 Paris)

Toutes les règles sont idempotentes (dédoublonnage par category|entity_type|id, comme aujourd'hui) et se ferment automatiquement (`auto_completed`) dans `check-daily-actions-completion`.

1. **Retour à traiter** : une fonction pure `detectFeedbackSignal(source, row)` décide si l'évaluation est un signal : note ≤ 3, recommandation « non », booléen qualité à false, ou texte d'amélioration significatif (au moins 15 caractères après nettoyage, et pas « rien », « RAS », « non », « tout était parfait », etc.). Si oui, une ligne dans la file et une action « Traiter le retour de [nom] sur [formation] ». Se ferme quand `decision` ≠ pending.
   Détection : un déclencheur base de données à la soumission (chaud, froid participant et commanditaire, parties prenantes, formateurs) insère dans la file, avec un passage de rattrapage dans le cron.
2. **Réclamation ouverte** : action immédiate à la création (déclencheur, puis le cron). Relance si `response_date` est vide après 5 jours ouvrés. Se ferme au passage au statut traité/clos.
3. **Amélioration en retard** : non terminée avec échéance passée, « Faire avancer : [titre] ». Sans échéance : « Fixer une échéance : [titre] ». Terminée sans effet constaté 60 jours après sa clôture : « Mesurer l'effet : [titre] ».
4. **Collecte manquante** : session terminée depuis 30 jours (et terminée après le 02/11/2026, même règle que les évaluations à froid) sans évaluation à froid commanditaire envoyée ou reçue, ou dont la relance n'est pas partie : action de relance avec un brouillon d'email à copier (rien n'est envoyé). Même règle pour l'évaluation formateur quand le formateur n'est pas Romain.
5. **Synthèse de fin de session** : quand toutes les évaluations à chaud sont soumises, ou 7 jours après la fin, appel de `analyze-evaluations` (IA existante), enregistrement dans `evaluation_analyses`, propositions d'améliorations en brouillon et action « Valider la synthèse et les améliorations proposées pour [formation] ». Se ferme à la validation.

Mail quotidien : ajout du libellé et de l'ordre de la catégorie « Qualité » seulement. Le reste du mail ne change pas.

## 3. Écran « Amélioration continue » (refonte de la page Améliorations existante, 3 onglets)

- **À traiter** : la file des retours en attente (extrait, motifs, note, formation, lien vers l'évaluation). Trois boutons : Créer une amélioration (formulaire pré-rempli : source, formation, titre suggéré), Rattacher (choix d'une amélioration ouverte), Sans suite (motif court obligatoire). Les synthèses à valider sont affichées en tête.
- **Améliorations** : tableau avec statut, priorité, responsable, échéance, source (lien), date de clôture, effet constaté (modifiable directement), filtres et compteur de retours rattachés.
- **Tableau de bord** : compteurs du mois (retours reçus, traités, améliorations ouvertes et clôturées, taux de collecte à froid commanditaire et participant), avec un choix de mois.

## 4. Preuve d'audit

Export sur une période choisie, en CSV et en PDF (généré dans le navigateur) : retour (date, source, formation, extrait), décision et motif, amélioration associée, statut, échéance, clôture, effet constaté. En-tête : période, compteurs et taux de collecte.

## 5. Assistant (MCP)

Outils `list_improvements`, `get_improvement`, `create_improvement`, `update_improvement` (statut, échéance, responsable, effet constaté), et `list_quality_feedback` / `decide_quality_feedback` pour traiter la file. Chaque appel agit sous l'identité de l'utilisateur connecté et respecte les droits. Les écritures sont tracées dans `activity_logs`. Une republication sera nécessaire.

## 6. Reprise (une fois, après validation)

- Actions pour les 5 améliorations en attente (règle 3).
- Passage des évaluations soumises dans les 60 derniers jours dans la détection : seuls les signaux non traités entrent dans la file.
- Pas de synthèse IA rétroactive, sauf demande.
- Je te donne ensuite le nombre d'éléments créés par type.

## 7. Tests

Tests unitaires dans `supabase/tests/` : détection des signaux (seuils, textes non significatifs), jours ouvrés pour la relance des réclamations, éligibilité de la collecte manquante (30 jours, date limite du 02/11, formateur différent de Romain), et absence de doublon.

## Questions

1. Quel seuil pour « note basse » : ≤ 3 sur toutes les notes, ou seulement l'appréciation générale ?
2. Un retour positif avec suggestion (5/5 et texte d'amélioration) entre-t-il aussi dans la file ? Je propose oui.
3. Le délai pour mesurer l'effet après clôture : 60 jours, ça te va ?
4. Les actions Qualité vont-elles toutes à toi, ou au responsable de l'amélioration quand c'est un utilisateur de SuperTools ?
5. Comment identifier « Romain » comme formateur : ton compte utilisateur, ou une fiche formateur précise ?
6. Faut-il garder les synthèses IA en brouillon jusqu'à ta validation (aucune amélioration créée seule) ? C'est ce que je propose.

## Détails techniques

- Migrations : création de la table avec GRANT, RLS et politiques, colonnes ajoutées sur `improvements` et `evaluation_analyses`, déclencheurs `AFTER INSERT OR UPDATE OF etat/submitted_at` sur les tables sources, qui appellent une fonction SQL d'insertion `ON CONFLICT DO NOTHING`. La logique de détection est dupliquée en TS pur (`_shared/quality-signals.ts`) et testée ; le déclencheur insère largement et le cron filtre.
- Pas de serveur MCP dans `src/lib/mcp` aujourd'hui : il faudra vérifier où vit le MCP actuel (transcripts, etc.) et y ajouter les outils plutôt que d'en créer un second.
- Respect des règles `scripts/check-rules.sh` et de la date limite partagée (`cold-evaluation.ts`).
