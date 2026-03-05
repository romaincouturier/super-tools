-- Allow orphan entries (no training/participant) for both tables
ALTER TABLE public.questionnaire_besoins ALTER COLUMN training_id DROP NOT NULL;
ALTER TABLE public.questionnaire_besoins ALTER COLUMN participant_id DROP NOT NULL;
ALTER TABLE public.training_evaluations ALTER COLUMN training_id DROP NOT NULL;
ALTER TABLE public.training_evaluations ALTER COLUMN participant_id DROP NOT NULL;