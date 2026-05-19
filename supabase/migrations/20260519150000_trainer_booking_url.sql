-- ============================================================
-- Ajoute booking_url à trainers pour la prise de RDV coaching
-- Étend get_learner_portal_data avec coaching_sessions_completed,
-- coaching_sessions_total, trainer_booking_url
-- ============================================================

ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS booking_url TEXT;

CREATE OR REPLACE FUNCTION public.get_learner_portal_data(p_email text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

        -- E-Learning
        'lms_course_id',    t.supports_lms_course_id,
        'lms_course_title', (
          SELECT lc.title
          FROM lms_courses lc
          WHERE lc.id = t.supports_lms_course_id
        ),
        'lms_completion', (
          SELECT le.completion_percentage
          FROM lms_enrollments le
          WHERE le.course_id = t.supports_lms_course_id
            AND lower(le.learner_email) = lower(p_email)
        ),
        'last_lesson_id', (
          SELECT pv.lesson_id::text
          FROM lms_page_views pv
          WHERE pv.course_id = t.supports_lms_course_id
            AND lower(pv.learner_email) = lower(p_email)
          ORDER BY pv.viewed_at DESC
          LIMIT 1
        ),
        'next_event', (
          SELECT row_to_json(ev)
          FROM (
            SELECT lm.id, lm.title, lm.scheduled_at, lm.meeting_url, lm.meeting_type
            FROM training_live_meetings lm
            WHERE lm.training_id = t.id
              AND lm.scheduled_at > NOW()
              AND lm.status = 'scheduled'
            ORDER BY lm.scheduled_at ASC
            LIMIT 1
          ) ev
        ),
        'is_coached', COALESCE((
          SELECT ff.coaching_sessions_count > 0
          FROM formation_formulas ff
          WHERE ff.id = tp.formula_id
        ), false),
        'is_permanent', (t.start_date IS NULL),

        -- Coaching sessions (depuis training_participants)
        'coaching_sessions_completed', tp.coaching_sessions_completed,
        'coaching_sessions_total',     tp.coaching_sessions_total,

        -- Booking URL du formateur
        'trainer_booking_url', (
          SELECT tr.booking_url FROM trainers tr WHERE tr.id = t.trainer_id
        )
      ) ORDER BY t.start_date DESC NULLS LAST)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(p_email)
    ), '[]'::json),

    'questionnaires', COALESCE((
      SELECT json_agg(json_build_object(
        'token',       q.token,
        'training_id', q.training_id,
        'etat',        q.etat
      ))
      FROM questionnaire_besoins q
      WHERE lower(q.email) = lower(p_email)
    ), '[]'::json),

    'evaluations', COALESCE((
      SELECT json_agg(json_build_object(
        'token',       e.token,
        'training_id', e.training_id,
        'etat',        e.etat
      ))
      FROM training_evaluations e
      WHERE lower(e.email) = lower(p_email)
    ), '[]'::json)
  );
END;
$function$;
