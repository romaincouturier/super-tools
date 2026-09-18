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
  v_count   integer;
  v_state   text;
BEGIN
  IF v_email IS NULL OR v_email = '' OR p_email_hash IS NULL OR p_email_hash = '' THEN
    RETURN 'unknown';
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE email_hash = p_email_hash AND resolved_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
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
  v_state := CASE WHEN v_user_id IS NOT NULL THEN 'password' ELSE 'unknown' END;

  INSERT INTO identity_resolution_log (email_hash, ip_address, state)
  VALUES (p_email_hash, v_ip, v_state);

  RETURN v_state;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_login_identity(text, text, text) FROM PUBLIC, anon, authenticated;

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
    SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
  ) THEN
    RETURN v_email;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.change_learner_email(
  p_old_email text,
  p_new_email text,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old text := lower(trim(p_old_email));
  v_new text := lower(trim(p_new_email));
  v_moved integer := 0;
  v_touched integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Réservé à l''équipe SuperTilt';
  END IF;
  IF v_old IS NULL OR v_new IS NULL OR v_old = '' OR v_new = '' THEN
    RAISE EXCEPTION 'Adresses requises';
  END IF;
  IF v_new !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Nouvelle adresse invalide';
  END IF;
  IF v_old = v_new THEN
    RAISE EXCEPTION 'Les deux adresses sont identiques';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new)
     OR EXISTS (SELECT 1 FROM training_participants WHERE lower(email) = v_new)
     OR EXISTS (SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_new) THEN
    RAISE EXCEPTION 'Cette adresse est déjà utilisée par un autre apprenant';
  END IF;

  UPDATE training_participants     SET email = v_new         WHERE lower(email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE questionnaire_besoins     SET email = v_new         WHERE lower(email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE training_evaluations      SET email = v_new         WHERE lower(email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE training_survey_recipients SET email = v_new        WHERE lower(email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE learner_profiles          SET email = v_new         WHERE lower(email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;

  UPDATE lms_enrollments           SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_progress              SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_quiz_attempts         SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_submissions           SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_assignment_submissions SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_badge_awards          SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_user_badges           SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_work_deposits         SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_page_views            SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_lesson_comments       SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_messages              SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE learner_notifications     SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE group_matching_members    SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE group_matching_registrations SET learner_email = v_new WHERE lower(learner_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;

  UPDATE lms_forum_posts           SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_deposit_comments      SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE lms_deposit_reactions     SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE practice_posts            SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE practice_post_comments    SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE practice_post_reactions   SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;
  UPDATE practice_poll_votes       SET author_email = v_new  WHERE lower(author_email) = v_old;
  GET DIAGNOSTICS v_touched = ROW_COUNT; v_moved := v_moved + v_touched;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object('old_email', v_old, 'new_email', v_new, 'rows_moved', v_moved);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.connexion_indicators(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_since timestamptz := now() - make_interval(days => p_days);
  v_provisioned integer;
  v_activated integer;
  v_logins integer;
  v_failed integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Réservé à l''équipe SuperTilt';
  END IF;

  SELECT count(*) INTO v_provisioned
    FROM auth.users u
    JOIN user_security_metadata m ON m.user_id = u.id
   WHERE u.created_at > v_since AND m.password_set = false;

  SELECT count(*) INTO v_activated
    FROM auth.users u
    JOIN user_security_metadata m ON m.user_id = u.id
   WHERE u.created_at > v_since AND m.password_set = false
     AND u.last_sign_in_at IS NOT NULL;

  SELECT count(*) INTO v_logins  FROM login_attempts WHERE attempted_at > v_since AND success;
  SELECT count(*) INTO v_failed  FROM login_attempts WHERE attempted_at > v_since AND NOT success;

  RETURN json_build_object(
    'window_days', p_days,
    'provisioned_accounts', v_provisioned,
    'activated_accounts', v_activated,
    'activation_rate', CASE WHEN v_provisioned > 0
      THEN round(100.0 * v_activated / v_provisioned, 1) ELSE NULL END,
    'successful_logins', v_logins,
    'failed_logins', v_failed,
    'first_try_rate', CASE WHEN (v_logins + v_failed) > 0
      THEN round(100.0 * v_logins / (v_logins + v_failed), 1) ELSE NULL END,
    'resolutions', (SELECT count(*) FROM identity_resolution_log WHERE resolved_at > v_since),
    'resolutions_throttled', (SELECT count(*) FROM identity_resolution_log
      WHERE resolved_at > v_since AND state = 'throttled')
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.connexion_indicators(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connexion_indicators(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_access_level()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RETURN 'staff';
  END IF;

  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    RETURN 'none';
  END IF;

  IF EXISTS (SELECT 1 FROM training_participants WHERE lower(email) = v_email)
     OR EXISTS (SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email) THEN
    RETURN 'learner';
  END IF;

  RETURN 'none';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_access_level() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_level() TO authenticated;

DROP FUNCTION IF EXISTS public.validate_learner_token(text);
DROP FUNCTION IF EXISTS public.preview_learner_token(text);
DROP FUNCTION IF EXISTS public.consume_learner_token(text);
DROP TABLE IF EXISTS public.learner_magic_links CASCADE;