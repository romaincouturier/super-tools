-- lot5_retrait_elearning_access_mode
DELETE FROM public.app_settings WHERE setting_key = 'elearning_access_mode';

-- lot6_adresse_indicateurs
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

  UPDATE learner_magic_links SET used_at = now()
   WHERE lower(email) = v_old AND used_at IS NULL;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object('old_email', v_old, 'new_email', v_new, 'rows_moved', v_moved);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_dormant_learner_accounts(p_years integer DEFAULT 3)
RETURNS TABLE (email text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Réservé à l''équipe SuperTilt';
  END IF;

  RETURN QUERY
  SELECT u.email::text, u.created_at, u.last_sign_in_at
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id)
    AND COALESCE(u.last_sign_in_at, u.created_at) < now() - make_interval(years => p_years)
    AND NOT EXISTS (
      SELECT 1 FROM training_participants tp
       JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(u.email)
        AND COALESCE(t.end_date, t.start_date) > now() - make_interval(years => p_years)
    )
    AND NOT EXISTS (
      SELECT 1 FROM lms_progress lp
      WHERE lower(lp.learner_email) = lower(u.email)
        AND lp.updated_at > now() - make_interval(years => p_years)
    )
  ORDER BY COALESCE(u.last_sign_in_at, u.created_at);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_dormant_learner_accounts(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_dormant_learner_accounts(integer) TO authenticated;

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
  v_links integer;
  v_expired integer;
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
  SELECT count(*) INTO v_links   FROM learner_magic_links WHERE created_at > v_since;
  SELECT count(*) INTO v_expired FROM learner_magic_links
   WHERE created_at > v_since AND used_at IS NULL AND expires_at < now();

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
    'links_sent', v_links,
    'links_expired_unused', v_expired,
    'resolutions', (SELECT count(*) FROM identity_resolution_log WHERE resolved_at > v_since),
    'resolutions_throttled', (SELECT count(*) FROM identity_resolution_log
      WHERE resolved_at > v_since AND state = 'throttled')
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.connexion_indicators(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connexion_indicators(integer) TO authenticated;

-- recette_niveau_acces_et_mentions
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
     OR EXISTS (SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email)
     OR EXISTS (SELECT 1 FROM learner_magic_links
                 WHERE lower(email) = v_email AND used_at IS NOT NULL) THEN
    RETURN 'learner';
  END IF;

  RETURN 'none';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_access_level() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_level() TO authenticated;

-- recette_p4_quota_purge_sessions
CREATE OR REPLACE FUNCTION public.check_link_quota(p_email_hash text, p_ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip    text := COALESCE(NULLIF(p_ip, ''), 'unknown');
  v_count integer;
BEGIN
  IF p_email_hash IS NULL OR p_email_hash = '' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE email_hash = p_email_hash AND state = 'link_sent'
     AND resolved_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE ip_address = v_ip AND v_ip <> 'unknown' AND state = 'link_sent'
     AND resolved_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
    RETURN false;
  END IF;

  INSERT INTO identity_resolution_log (email_hash, ip_address, state)
  VALUES (p_email_hash, v_ip, 'link_sent');
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_link_quota(text, text) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('purge-identity-resolution-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-identity-resolution-log');

SELECT cron.schedule(
  'purge-identity-resolution-log',
  '20 3 * * *',
  $$SELECT public.purge_identity_resolution_log();$$
);

CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current uuid;
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  v_current := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;

  DELETE FROM auth.sessions
   WHERE user_id = auth.uid()
     AND (v_current IS NULL OR id <> v_current);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.revoke_other_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;

-- bandeau_maintenance_connexion
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'maintenance_banner_enabled',
  'false',
  'Affiche un bandeau d''information sur les écrans de connexion ("true" ou "false")'
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'maintenance_banner_message',
  'Nous faisons évoluer notre plateforme. Pendant cette phase de tests et de migration, vous pourriez rencontrer ponctuellement quelques difficultés d''accès. Nous faisons au mieux pour que cette période soit la plus courte et la plus discrète possible. Merci pour votre patience et votre compréhension.',
  'Texte du bandeau d''information affiché sur les écrans de connexion'
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_app_setting_public(p_key text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT setting_value
  FROM app_settings
  WHERE setting_key = p_key
    AND p_key IN (
      'reglement_interieur_url',
      'sentry_dsn',
      'app_url',
      'website_url',
      'timezone',
      'qualiopi_certificate_path',
      'maintenance_banner_enabled',
      'maintenance_banner_message'
    );
$function$;

-- garde_fou_colonnes_connexion
DO $$
DECLARE
  v_manquantes text;
BEGIN
  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ' ORDER BY t.table_name)
    INTO v_manquantes
  FROM (VALUES
    ('training_participants', 'email'),
    ('questionnaire_besoins', 'email'),
    ('training_evaluations', 'email'),
    ('training_survey_recipients', 'email'),
    ('learner_profiles', 'email'),
    ('lms_enrollments', 'learner_email'),
    ('lms_progress', 'learner_email'),
    ('lms_quiz_attempts', 'learner_email'),
    ('lms_submissions', 'learner_email'),
    ('lms_assignment_submissions', 'learner_email'),
    ('lms_badge_awards', 'learner_email'),
    ('lms_user_badges', 'learner_email'),
    ('lms_work_deposits', 'learner_email'),
    ('lms_page_views', 'learner_email'),
    ('lms_lesson_comments', 'learner_email'),
    ('lms_messages', 'learner_email'),
    ('learner_notifications', 'learner_email'),
    ('group_matching_members', 'learner_email'),
    ('group_matching_registrations', 'learner_email'),
    ('lms_forum_posts', 'author_email'),
    ('lms_deposit_comments', 'author_email'),
    ('lms_deposit_reactions', 'author_email'),
    ('practice_posts', 'author_email'),
    ('practice_post_comments', 'author_email'),
    ('practice_post_reactions', 'author_email'),
    ('practice_poll_votes', 'author_email')
  ) AS t(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = t.table_name
       AND c.column_name = t.column_name
  );

  IF v_manquantes IS NOT NULL THEN
    RAISE EXCEPTION
      'change_learner_email référence des colonnes absentes : %. Corriger la fonction avant de déployer.',
      v_manquantes;
  END IF;
END
$$;

DO $$
DECLARE
  v_manquantes text;
BEGIN
  SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ' ORDER BY t.table_name)
    INTO v_manquantes
  FROM (VALUES
    ('trainings', 'end_date'),
    ('trainings', 'start_date'),
    ('trainings', 'supports_lms_course_id'),
    ('lms_progress', 'updated_at'),
    ('learner_magic_links', 'expires_at'),
    ('learner_magic_links', 'used_at'),
    ('learner_magic_links', 'created_at'),
    ('login_attempts', 'attempted_at'),
    ('login_attempts', 'success'),
    ('user_security_metadata', 'password_set'),
    ('user_security_metadata', 'must_change_password')
  ) AS t(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = t.table_name
       AND c.column_name = t.column_name
  );

  IF v_manquantes IS NOT NULL THEN
    RAISE EXCEPTION
      'Les fonctions de connexion référencent des colonnes absentes : %.', v_manquantes;
  END IF;
END
$$;