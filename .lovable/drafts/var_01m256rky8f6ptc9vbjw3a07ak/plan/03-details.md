## Visibilité des onglets — calcul depuis les données existantes

Aucun nouveau champ ni table.

- **Coaching** : visible si `training_participants.coaching_sessions_total > 0` pour ce participant. On abandonne le test actuel `is_coached` (dérivé de `formation_formulas.coaching_sessions_count`, incomplet dans le catalogue).
- **Documents** : visible s'il existe au moins une ligne dans `training_documents` pour la formation OU dans `participant_files` pour le participant.
- **Formation** : toujours visible (cours LMS via `lms_enrollments`).

Contrainte constatée : ces deux tables sont en lecture réservée au personnel (`is_staff_user()`), donc l'apprenant ne peut pas les interroger directement. Le calcul doit se faire dans la fonction serveur existante qui alimente le portail, laquelle s'exécute avec les droits élevés.

## Détails techniques

1. **Fonction serveur `get_learner_portal_data`** : ajouter dans l'objet JSON déjà renvoyé par formation, sans nouvelle colonne ni table :
   - `has_documents` : `EXISTS` sur `training_documents` (par `training_id`) `OR` `EXISTS` sur `participant_files` (par `participant_id`), en gardant aussi les liens déjà existants (`program_file_url`, `supports_url`, questionnaire, évaluation) comme sources de documents affichables.
   - `has_coaching` : `tp.coaching_sessions_total > 0`.
   - `last_activity_at` : `MAX(viewed_at)` de `lms_page_views` pour ce cours et cet e-mail, nécessaire au tri par dernière activité.
   Cette modification est préparée comme migration additive et s'appliquera à l'application au moment où vous accepterez ce brouillon ; elle ne peut donc pas être testée avant.

2. **`src/types/learner-portal.ts`** : ajouter `has_documents?`, `has_coaching?`, `last_activity_at?` au type `Training`.

3. **`src/components/learner/portal/LearnerTrainingCard.tsx`** :
   - `FormationItem` : supprimer la branche `!primary` (ligne compacte) et le prop `primary`. Une seule mise en forme, `rounded-2xl`, bordure et ombre `0 2px 20px rgba(16,24,32,0.06)`.
   - Bouton principal jaune : « Commencer » (0 %), « Reprendre » (en cours), « Revoir » (100 %) ; secondaire « Accueil du cours ». Plus de bouton noir. Boutons `w-full` empilés sous `sm`.
   - Ligne d'onglets rendue seulement si `has_documents` ou `has_coaching`, dans la carte après un `border-t`.
   - `TrainingDetail` : recevoir la liste d'onglets à afficher et ne construire `TabsList`/`TabsContent` que pour ceux-là ; `defaultValue` sur le premier onglet disponible. `CoachingCircles` conditionné à `coaching_sessions_total > 0`.

4. **`src/pages/LearnerPortal.tsx`** :
   - Helper de tri partagé : dernière activité décroissante (`last_activity_at`, repli sur progression > 0), puis non commencées, puis terminées (100 %).
   - Tableau de bord : titre `Mes formations (${total})`, `slice(0, 3)`, `space-y-4`. Si `total > 3`, lien en bas « Voir mes N formations → » ; sinon, lien discret actuel dans `DashCard`.
   - Vue « Mes formations » : même tri, toutes les formations, même carte.
   - Aucune autre section du tableau de bord touchée.

5. Vérification : `npx tsgo --noEmit -p tsconfig.app.json` puis contrôle visuel de la page apprenant (desktop et mobile).
