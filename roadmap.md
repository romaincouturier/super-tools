# Roadmap

- [ ] Landing publique Academy SuperTilt : refonte, parcours gratuit et sélection éditoriale
- [ ] Mail d'attente Echo aux clients de la colonne "Reçues" (proposition rédigée, envoi à valider)
- [x] Convocations J-7 non programmées : rattrapage via `reconcile-welcome-emails` (appelé à la mise à jour de `start_date` et par le cron `process-scheduled-emails`). Cas Agirc-ARRCO corrigé (7 convocations programmées au 01/10).
- [x] Icône avion : `needs_survey_status = programme` affichait "Convocation envoyée" (corrigé : "Convocation programmée")
- [x] Sentry JAVASCRIPT-REACT-F : parcours TED interrompu par un 429 (2 avis sur 58) — backoff/reprise paginée ajouté dans `walkTedPages` et `ted-sync`
- [x] Monitoring : `get_course_training_sessions_admin` appelait `is_admin()` (0 arg) inexistant → corrigé en `is_admin(auth.uid())`
- [x] Monitoring : prévisualisation email alignée sur le rendu réel par type de modèle (escaped / puces / HTML brut)
- [x] Suppression d'un compte apprenant : déjà disponible sur /lms/apprenants (edge `manage-learner-account`, admin uniquement)
- [x] Dette technique : 4 ratchets ramenés à la baseline + `CREATE POLICY` rendu idempotent → check-rules 65/65
