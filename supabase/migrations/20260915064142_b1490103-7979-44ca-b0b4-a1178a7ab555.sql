CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_email := lower(trim(auth.jwt() ->> 'email'));
    IF v_email IS NULL OR v_email = '' THEN
      RETURN NULL;
    END IF;
    RETURN v_email;
  END IF;

  v_email := lower(trim(
    current_setting('request.headers', true)::json ->> 'x-learner-email'
  ));
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.training_participants WHERE lower(trim(email)) = v_email
  ) OR EXISTS (
    SELECT 1 FROM public.learner_magic_links
    WHERE lower(trim(email)) = v_email AND used_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.lms_enrollments WHERE lower(trim(learner_email)) = v_email
  ) THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$function$;