-- Lot 6 de la refonte de connexion apprenant.
-- Référence : docs/SPEC_CONNEXION_APPRENANT.md, W13, RG-19, RG-23, chapitre 20.
--   1. changement d'adresse atomique, propagé à tous les référentiels
--   2. comptes apprenants dormants, signalés pour suppression
--   3. indicateurs de succès de la refonte

-- ── 1. Changement d'adresse (W13) ───────────────────────────────────────────
-- Le portail résout les contenus par email : changer l'adresse du seul compte
-- d'authentification détachait silencieusement l'apprenant de ses formations.
-- Tout bouge donc ensemble, ou rien ne bouge.
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

  -- La fusion de deux identités n'est pas couverte : on refuse plutôt que de
  -- mélanger deux parcours (W13 étape 5).
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new)
     OR EXISTS (SELECT 1 FROM training_participants WHERE lower(email) = v_new)
     OR EXISTS (SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_new) THEN
    RAISE EXCEPTION 'Cette adresse est déjà utilisée par un autre apprenant';
  END IF;

  -- Référentiels métier
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

  -- Parcours LMS
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

  -- Contributions signées par l'adresse
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

  -- Les liens envoyés à l'ancienne adresse ne valent plus rien (RG-19).
  UPDATE learner_magic_links SET used_at = now()
   WHERE lower(email) = v_old AND used_at IS NULL;

  -- Les sessions ouvertes sont fermées : la prochaine entrée se fait avec la
  -- nouvelle adresse.
  IF p_user_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object('old_email', v_old, 'new_email', v_new, 'rows_moved', v_moved);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_learner_email(text, text, uuid) TO authenticated;

-- ── 2. Comptes dormants (RG-23) ─────────────────────────────────────────────
-- Signale, ne supprime pas. La suppression reste une décision, prise depuis
-- l'administration des comptes apprenants.
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

-- ── 3. Indicateurs de la refonte (chapitre 20) ──────────────────────────────
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
