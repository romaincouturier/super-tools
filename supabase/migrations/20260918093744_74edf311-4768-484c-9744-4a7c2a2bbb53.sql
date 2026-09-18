-- lot1_identite_apprenant
CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(
      (current_setting('request.headers', true)::json->>'x-learner-email')
    );
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM training_participants WHERE lower(email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM learner_magic_links
    WHERE lower(email) = v_email AND used_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
  ) THEN
    RETURN v_email;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_learner_portal_data(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text;
BEGIN
  v_caller := lower(auth.jwt() ->> 'email');
  IF v_caller IS NULL OR v_caller = '' THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF lower(p_email) <> v_caller
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN json_build_object(
    'email', p_email,
    'trainings', COALESCE((
      SELECT json_agg(json_build_object(
        'training_id',         t.id,
        'training_name',       t.training_name,
        'start_date',          t.start_date,
        'end_date',            t.end_date,
        'location',            t.location,
        'format',              t.format_formation,
        'participant_id',      tp.id,
        'first_name',          tp.first_name,
        'last_name',           tp.last_name,
        'needs_survey_status', tp.needs_survey_status,
        'program_file_url',    t.program_file_url,
        'supports_url',        t.supports_url,
        'objectives',          COALESCE(t.objectives, '{}'),
        'prerequisites',       COALESCE(t.prerequisites, '{}'),
        'reglement_interieur_url', (
          SELECT s.setting_value FROM app_settings s
          WHERE s.setting_key = 'reglement_interieur_url' LIMIT 1
        ),
        'trainer_name', (
          SELECT tr.first_name || ' ' || tr.last_name
          FROM trainers tr WHERE tr.id = t.trainer_id
        ),
        'trainer_photo_url', (
          SELECT tr.photo_url FROM trainers tr WHERE tr.id = t.trainer_id
        ),
        'lms_course_id',    t.supports_lms_course_id,
        'lms_course_title', (
          SELECT lc.title FROM lms_courses lc WHERE lc.id = t.supports_lms_course_id
        ),
        'lms_completion', (
          SELECT le.completion_percentage FROM lms_enrollments le
          WHERE le.course_id = t.supports_lms_course_id
            AND lower(le.learner_email) = lower(p_email)
        ),
        'last_lesson_id', (
          SELECT pv.lesson_id::text FROM lms_page_views pv
          WHERE pv.course_id = t.supports_lms_course_id
            AND lower(pv.learner_email) = lower(p_email)
          ORDER BY pv.viewed_at DESC LIMIT 1
        ),
        'last_activity_at', (
          SELECT MAX(pv.viewed_at) FROM lms_page_views pv
          WHERE pv.course_id = t.supports_lms_course_id
            AND lower(pv.learner_email) = lower(p_email)
        ),
        'documents', COALESCE((
          SELECT json_agg(d ORDER BY d.file_name)
          FROM (
            SELECT td.file_name, td.file_url
            FROM training_documents td
            WHERE td.training_id = t.id
            UNION ALL
            SELECT pf.file_name, pf.file_url
            FROM participant_files pf
            WHERE pf.participant_id = tp.id
          ) d
        ), '[]'::json),
        'has_documents', (
          EXISTS (SELECT 1 FROM training_documents td WHERE td.training_id = t.id)
          OR EXISTS (SELECT 1 FROM participant_files pf WHERE pf.participant_id = tp.id)
          OR t.program_file_url IS NOT NULL
          OR t.supports_url IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM questionnaire_besoins q
            WHERE q.training_id = t.id AND lower(q.email) = lower(p_email)
          )
          OR EXISTS (
            SELECT 1 FROM training_evaluations e
            WHERE e.training_id = t.id AND lower(e.email) = lower(p_email)
          )
        ),
        'has_coaching', COALESCE(tp.coaching_sessions_total, 0) > 0,
        'has_coaching_active', COALESCE(tp.coaching_sessions_total, 0) > 0,
        'coaching_available', EXISTS (
          SELECT 1 FROM formation_formulas ff2
          WHERE ff2.coaching_sessions_count > 0
            AND ff2.formation_config_id = COALESCE(
              (SELECT ff.formation_config_id FROM formation_formulas ff WHERE ff.id = tp.formula_id),
              (SELECT fc.id FROM formation_configs fc
                WHERE fc.formation_name = t.training_name LIMIT 1)
            )
        ),
        'next_event', (
          SELECT row_to_json(ev) FROM (
            SELECT lm.id, lm.title, lm.scheduled_at, lm.meeting_url, lm.meeting_type
            FROM training_live_meetings lm
            WHERE lm.training_id = t.id
              AND lm.scheduled_at > NOW()
              AND lm.status = 'scheduled'
            ORDER BY lm.scheduled_at ASC LIMIT 1
          ) ev
        ),
        'is_coached', COALESCE((
          SELECT ff.coaching_sessions_count > 0
          FROM formation_formulas ff WHERE ff.id = tp.formula_id
        ), false),
        'is_permanent', (t.start_date IS NULL),
        'coaching_sessions_completed', tp.coaching_sessions_completed,
        'coaching_sessions_total',     tp.coaching_sessions_total,
        'trainer_booking_url', (
          SELECT tr.booking_url FROM trainers tr WHERE tr.id = t.trainer_id
        )
      ) ORDER BY t.start_date DESC NULLS LAST)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(p_email)
        AND t.supports_lms_course_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM lms_courses lc
          WHERE lc.id = t.supports_lms_course_id
            AND lc.status = 'published'
        )
    ), '[]'::json),

    'questionnaires', COALESCE((
      SELECT json_agg(json_build_object(
        'token', q.token, 'training_id', q.training_id, 'etat', q.etat
      )) FROM questionnaire_besoins q
      WHERE lower(q.email) = lower(p_email)
    ), '[]'::json),

    'evaluations', COALESCE((
      SELECT json_agg(json_build_object(
        'token', e.token, 'training_id', e.training_id, 'etat', e.etat
      )) FROM training_evaluations e
      WHERE lower(e.email) = lower(p_email)
    ), '[]'::json)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_learner_portal_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_learner_portal_training_details(text) TO authenticated;

-- lot3_resolution_identite
ALTER TABLE public.user_security_metadata
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_security_metadata.password_set IS
  'Vrai si le compte a un mot de passe utilisable. Écrit uniquement côté serveur.';

CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  INSERT INTO user_security_metadata (user_id, must_change_password, password_set)
  VALUES (auth.uid(), false, true)
  ON CONFLICT (user_id) DO UPDATE
    SET must_change_password = false, password_set = true, updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  INSERT INTO user_security_metadata (user_id, must_change_password)
  VALUES (auth.uid(), true)
  ON CONFLICT (user_id) DO UPDATE
    SET must_change_password = true, updated_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_password_change() TO authenticated;

CREATE TABLE IF NOT EXISTS public.identity_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_address text NOT NULL DEFAULT 'unknown',
  state text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.identity_resolution_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_identity_resolution_email
  ON public.identity_resolution_log (email_hash, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_resolution_ip
  ON public.identity_resolution_log (ip_address, resolved_at DESC);

ALTER TABLE public.identity_resolution_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.purge_identity_resolution_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM identity_resolution_log WHERE resolved_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_identity_resolution_log() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_login_identity(
  p_email text,
  p_email_hash text,
  p_ip text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email   text := lower(trim(p_email));
  v_ip      text := COALESCE(NULLIF(p_ip, ''), 'unknown');
  v_user_id uuid;
  v_has_pwd boolean;
  v_known   boolean;
  v_count   integer;
  v_state   text;
BEGIN
  IF v_email IS NULL OR v_email = '' OR p_email_hash IS NULL OR p_email_hash = '' THEN
    RETURN 'unknown';
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE email_hash = p_email_hash AND resolved_at > now() - interval '1 hour';
  IF v_count >= 5 THEN
    INSERT INTO identity_resolution_log (email_hash, ip_address, state)
    VALUES (p_email_hash, v_ip, 'throttled');
    RETURN 'throttled';
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE ip_address = v_ip AND v_ip <> 'unknown' AND resolved_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    INSERT INTO identity_resolution_log (email_hash, ip_address, state)
    VALUES (p_email_hash, v_ip, 'throttled');
    RETURN 'throttled';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT password_set INTO v_has_pwd
      FROM user_security_metadata WHERE user_id = v_user_id;
    v_state := CASE WHEN COALESCE(v_has_pwd, true) THEN 'password' ELSE 'link' END;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM training_participants WHERE lower(email) = v_email
    ) OR EXISTS (
      SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
    ) INTO v_known;
    v_state := CASE WHEN v_known THEN 'activation' ELSE 'unknown' END;
  END IF;

  INSERT INTO identity_resolution_log (email_hash, ip_address, state)
  VALUES (p_email_hash, v_ip, v_state);

  RETURN v_state;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_login_identity(text, text, text) FROM PUBLIC, anon, authenticated;