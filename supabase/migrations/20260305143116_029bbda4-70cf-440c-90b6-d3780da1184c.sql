-- Replace unique constraint to allow multiple questionnaires per participant (one per learndash_course_id)
ALTER TABLE public.questionnaire_besoins
  DROP CONSTRAINT questionnaire_besoins_training_id_participant_id_key;

-- New constraint: unique per training + participant + learndash_course_id
-- Using a unique index with COALESCE to handle NULLs
CREATE UNIQUE INDEX questionnaire_besoins_training_participant_course_idx
  ON public.questionnaire_besoins (training_id, participant_id, COALESCE(learndash_course_id, 0));