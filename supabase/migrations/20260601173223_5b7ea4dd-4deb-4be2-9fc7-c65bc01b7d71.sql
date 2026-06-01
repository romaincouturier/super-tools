ALTER TABLE public.mission_surveys
  ADD COLUMN IF NOT EXISTS require_identity boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.mission_surveys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_surveys TO authenticated;
GRANT ALL ON public.mission_surveys TO service_role;

GRANT SELECT ON public.mission_survey_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_survey_questions TO authenticated;
GRANT ALL ON public.mission_survey_questions TO service_role;

GRANT INSERT ON public.mission_survey_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_survey_responses TO authenticated;
GRANT ALL ON public.mission_survey_responses TO service_role;

GRANT INSERT ON public.mission_survey_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_survey_answers TO authenticated;
GRANT ALL ON public.mission_survey_answers TO service_role;

-- Allow anon to read questions of an active survey (public form)
DO $$ BEGIN
  CREATE POLICY "public_read_survey_questions_by_token"
    ON public.mission_survey_questions FOR SELECT TO anon
    USING (EXISTS (
      SELECT 1 FROM public.mission_surveys s
      WHERE s.id = mission_survey_questions.survey_id AND s.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;