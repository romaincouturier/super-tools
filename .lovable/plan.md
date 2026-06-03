# Sondages de formation

## Modèle de données (nouvelles tables, structure calquée sur `mission_surveys`)

- `training_surveys` : `id`, `training_id`, `title`, `intro_message` (texte du mail), `thank_you_message`, `email_subject`, `closes_at` (timestamptz, nullable), `is_active`, `created_by`, `created_at`, `updated_at`.
- `training_survey_questions` : `id`, `survey_id`, `type` (text/textarea/single_choice/multiple_choice/rating/nps/date), `label`, `description`, `required`, `position`, `options` (jsonb).
- `training_survey_recipients` : `id`, `survey_id`, `participant_id` (FK `training_participants`), `email`, `first_name`, `last_name`, `token` (uuid unique), `sent_at`, `last_reminded_at`. Un seul recipient par (survey, participant).
- `training_survey_responses` : `id`, `survey_id`, `recipient_id` (FK), `submitted_at`, `updated_at`. Unique (survey_id, recipient_id) — éditable.
- `training_survey_answers` : `id`, `response_id`, `question_id`, `value`, `values` (jsonb).
- RLS : lecture admin/staff via `is_admin()` + module `formations` ; insertion/màj des réponses via RPC SECURITY DEFINER `submit_training_survey(token, answers)` exécutable par `anon` (validation du token et de `closes_at`).
- GRANTs explicites pour chaque table (`authenticated`, `service_role`).

## Edge functions

- `send-training-survey` (JWT) : crée le sondage si non persisté, génère un `recipient` (token) par participant, envoie un email à chacun (BCC standard, signature, 400ms delay) avec le `intro_message` HTML + bouton "Répondre au sondage" → `https://super-tools.lovable.app/sondage-formation/{token}`. Log dans `sent_emails_log`.
- `training-survey-reminders` (cron 07h00 Paris) : pour chaque sondage actif dont `closes_at` est entre J+1 et J+2, envoie un rappel aux recipients sans `response`. Idempotent via `last_reminded_at`.

## UI

- `FormationDetail.tsx` : à côté du bouton "Email groupé", nouveau bouton **"Envoyer un sondage"** (icône ClipboardList).
- Dialog `TrainingSurveyDialog` :
  1. Champ titre + intro (Tiptap simplifié, comme bulk email).
  2. Date de clôture (DatePicker avec `pointer-events-auto`).
  3. Builder de questions réutilisant les composants existants des mission surveys (extraction d'un `SurveyQuestionsBuilder` partagé dans `src/components/surveys/`).
  4. Aperçu des destinataires (liste des participants avec email).
  5. Boutons "Enregistrer brouillon" / "Envoyer maintenant".
- Section **Résultats du sondage** sur la page formation (collapsible) : nombre de réponses / envois, taux, agrégats par question (moyennes pour rating/nps, distribution pour choix, liste pour texte), bouton export CSV.

## Page publique

- Route `/sondage-formation/:token` (`src/pages/TrainingSurveyResponse.tsx`) : `disableRedirect` dans `useAuth`, charge le sondage via RPC `get_training_survey_by_token(token)`, affiche les questions, permet soumission via RPC `submit_training_survey`. Si déjà répondu : pré-remplit et autorise modification jusqu'à `closes_at`. Après clôture : page "Sondage clôturé".

## Hooks

- `src/hooks/useTrainingSurveys.ts` : `useTrainingSurvey(trainingId)`, `useTrainingSurveyResults(surveyId)`, mutations `useUpsertTrainingSurvey`, `useSendTrainingSurvey`, `useSubmitTrainingSurveyResponse` (publique via RPC).

## Fichiers créés / modifiés

- migration SQL (tables + RPC + grants + RLS).
- `supabase/functions/send-training-survey/index.ts` (nouveau).
- `supabase/functions/training-survey-reminders/index.ts` (nouveau) + cron via `supabase--insert`.
- `supabase/config.toml` : enregistrer les 2 fonctions.
- `src/pages/TrainingSurveyResponse.tsx` (nouveau) + route dans `App.tsx`.
- `src/components/surveys/SurveyQuestionsBuilder.tsx` (extrait/partagé) + utilisé par missions et formations.
- `src/components/formations/TrainingSurveyDialog.tsx` (nouveau).
- `src/components/formations/TrainingSurveyResults.tsx` (nouveau).
- `src/hooks/useTrainingSurveys.ts` (nouveau).
- `src/pages/FormationDetail.tsx` (ajout bouton + section résultats).

## Hors scope

- Pas de sondage envoyé aux sponsors (uniquement participants).
- Pas d'envoi à des destinataires externes ajoutés manuellement.
- Pas de notifications Slack (peut être ajouté plus tard).
