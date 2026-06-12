
-- 1. Fix is_staff_user(): replace user-mutable JWT claim check with server-controlled tables.
-- Staff = admin OR has any module access. Learners by definition have neither.
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid())
    );
$function$;

-- 2. mission_surveys: drop the policy that exposes all active surveys (with tokens
-- and recipient emails) to anonymous users, and provide a SECURITY DEFINER RPC
-- that only returns the row whose token matches the caller-supplied token.
DROP POLICY IF EXISTS public_read_survey_by_token ON public.mission_surveys;

CREATE OR REPLACE FUNCTION public.get_mission_survey_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_survey public.mission_surveys%ROWTYPE;
  v_questions jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_survey
  FROM public.mission_surveys
  WHERE public_token = p_token AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q.*) ORDER BY q.position), '[]'::jsonb)
  INTO v_questions
  FROM public.mission_survey_questions q
  WHERE q.survey_id = v_survey.id;

  RETURN to_jsonb(v_survey) || jsonb_build_object('mission_survey_questions', v_questions);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mission_survey_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_survey_by_token(text) TO anon, authenticated;

-- 3. learner-photos bucket: replace the unrestricted anon INSERT with one that
-- requires the file path to start with the learner's verified email (via
-- get_learner_email()). Without a verified learner identity, no upload is allowed.
DROP POLICY IF EXISTS anon_upload_learner_photos ON storage.objects;

CREATE POLICY anon_upload_learner_photos
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'learner-photos'
  AND public.get_learner_email() IS NOT NULL
  AND name LIKE (public.get_learner_email() || '/%')
);
