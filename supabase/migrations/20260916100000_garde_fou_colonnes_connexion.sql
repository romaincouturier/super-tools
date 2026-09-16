-- Garde-fou de déploiement : les colonnes touchées existent-elles vraiment ?
--
-- Postgres ne vérifie pas le corps d'une fonction plpgsql à sa création. Une
-- colonne mal nommée dans change_learner_email n'exploserait donc qu'au premier
-- changement d'adresse réel, en production, devant l'utilisateur.
--
-- Cette migration vérifie au déploiement que les 26 couples table-colonne
-- existent. S'il en manque un, la migration échoue ici, bruyamment, et rien
-- n'est mis en service. C'est le seul moment où l'erreur coûte zéro.
--
-- Quand une table s'ajoute à change_learner_email, elle s'ajoute ici aussi.

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

-- Même garde pour les colonnes lues par les indicateurs et les comptes dormants.
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
