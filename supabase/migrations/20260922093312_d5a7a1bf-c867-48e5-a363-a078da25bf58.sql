-- Cinq fonctions réimplémentaient à la main « y a-t-il une ligne profiles
-- pour ce user_id ? » comme test d'appartenance à l'équipe SuperTilt, au lieu
-- d'appeler is_staff_user() — durcie le 2026-06-12 (voir
-- 20260612154854_6408dfb1-3ac8-4417-a066-a7174f1ca312.sql) : staff = admin
-- OU accès à un module, pas juste une ligne profiles. Trouvé par l'audit de
-- duplication qui a suivi l'extraction d'is_known_learner : même classe de
-- bug, côté équipe plutôt que côté apprenant.
--
-- Comportement resserré (volontairement, c'est le correctif) : une ligne
-- profiles sans is_admin ni accès module ne fait plus passer ces cinq
-- fonctions. Vérifié en base réelle avant application (2026-09-22) : les deux
-- seules lignes profiles existantes passent déjà is_staff_user() (une avec
-- is_admin = true, une avec un accès module) — aucun compte réel n'est
-- concerné aujourd'hui, ce correctif ne fait que fermer l'écart pour l'avenir.
--
-- change_learner_email, connexion_indicators, list_dormant_learner_accounts,
-- get_learner_portal_data : seule la garde change, corps identique par
-- ailleurs. Droits (GRANT/REVOKE) inchangés, CREATE OR REPLACE ne les touche
-- pas.
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
  IF NOT public.is_staff_user() THEN
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
  IF NOT public.is_staff_user() THEN
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

CREATE OR REPLACE FUNCTION public.list_dormant_learner_accounts(p_years integer DEFAULT 3)
RETURNS TABLE (email text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff_user() THEN
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

-- current_user_access_level : même remplacement pour sa branche « staff ».
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
  IF public.is_staff_user() THEN
    RETURN 'staff';
  END IF;

  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    RETURN 'none';
  END IF;

  IF public.is_known_learner(v_email) THEN
    RETURN 'learner';
  END IF;

  RETURN 'none';
END;
$function$;

-- get_learner_portal_data : même remplacement pour l'accès staff au dossier
-- d'un autre apprenant (prévisualisation).
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
     AND NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN json_build_object(
    'email', p_email,
    'trainings', (
      COALESCE((
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
      ), '[]'::json)::jsonb
      ||
      COALESCE((
        SELECT json_agg(json_build_object(
          'training_id',         lc.id,
          'training_name',       lc.title,
          'start_date',          NULL,
          'end_date',            NULL,
          'location',            NULL,
          'format',              'e_learning',
          'participant_id',      NULL,
          'first_name',          NULL,
          'last_name',           NULL,
          'needs_survey_status', NULL,
          'program_file_url',    NULL,
          'supports_url',        NULL,
          'objectives',          '{}'::text[],
          'prerequisites',       '{}'::text[],
          'reglement_interieur_url', NULL,
          'trainer_name',        NULL,
          'trainer_photo_url',   NULL,
          'lms_course_id',       lc.id,
          'lms_course_title',    lc.title,
          'lms_completion',      le.completion_percentage,
          'last_lesson_id', (
            SELECT pv.lesson_id::text FROM lms_page_views pv
            WHERE pv.course_id = lc.id
              AND lower(pv.learner_email) = lower(p_email)
            ORDER BY pv.viewed_at DESC LIMIT 1
          ),
          'last_activity_at', (
            SELECT MAX(pv.viewed_at) FROM lms_page_views pv
            WHERE pv.course_id = lc.id
              AND lower(pv.learner_email) = lower(p_email)
          ),
          'documents', '[]'::json,
          'has_documents', false,
          'has_coaching', false,
          'has_coaching_active', false,
          'coaching_available', false,
          'next_event', NULL,
          'is_coached', false,
          'is_permanent', true,
          'coaching_sessions_completed', NULL,
          'coaching_sessions_total', NULL,
          'trainer_booking_url', NULL
        ) ORDER BY lc.title)
        FROM lms_enrollments le
        JOIN lms_courses lc ON lc.id = le.course_id
        WHERE lower(le.learner_email) = lower(p_email)
          AND lc.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM training_participants tp2
            JOIN trainings t2 ON t2.id = tp2.training_id
            WHERE lower(tp2.email) = lower(p_email)
              AND t2.supports_lms_course_id = le.course_id
          )
      ), '[]'::json)::jsonb
    )::json,

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