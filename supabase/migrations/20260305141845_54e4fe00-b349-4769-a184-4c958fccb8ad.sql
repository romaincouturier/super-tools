-- Add learndash_course_id to questionnaire_besoins if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questionnaire_besoins' AND column_name = 'learndash_course_id'
  ) THEN
    ALTER TABLE public.questionnaire_besoins ADD COLUMN learndash_course_id integer;
  END IF;
END $$;

-- Add learndash_course_id to training_evaluations if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'training_evaluations' AND column_name = 'learndash_course_id'
  ) THEN
    ALTER TABLE public.training_evaluations ADD COLUMN learndash_course_id integer;
  END IF;
END $$;