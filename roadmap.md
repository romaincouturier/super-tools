# Roadmap

- [ ] Mail d'attente Echo aux clients de la colonne "Reçues" (proposition rédigée, envoi à valider)
- [x] Convocations J-7 non programmées : rattrapage via `reconcile-welcome-emails` (appelé à la mise à jour de `start_date` et par le cron `process-scheduled-emails`). Cas Agirc-ARRCO corrigé (7 convocations programmées au 01/10).
- [x] Icône avion : `needs_survey_status = programme` affichait "Convocation envoyée" (corrigé : "Convocation programmée")
- [x] Sentry JAVASCRIPT-REACT-F : parcours TED interrompu par un 429 (2 avis sur 58) — backoff/reprise paginée ajouté dans `walkTedPages` et `ted-sync`
- [x] Monitoring : `get_course_training_sessions_admin` appelait `is_admin()` (0 arg) inexistant → corrigé en `is_admin(auth.uid())`
- [x] Monitoring : prévisualisation email alignée sur le rendu réel par type de modèle (escaped / puces / HTML brut)
- [ ] Suppression d'un compte apprenant depuis l'admin (edge function service_role : purge `learner_profiles`, magic links, progression LMS, puis `auth.admin.deleteUser`) + écran de gestion des comptes apprenants
- [ ] Dette technique : ratchets Loader2 inline, `functions.invoke` inline, `catch {}` sans binding, réponses d'erreur manuelles ; `CREATE POLICY` non idempotent (migration 20260901080254)
