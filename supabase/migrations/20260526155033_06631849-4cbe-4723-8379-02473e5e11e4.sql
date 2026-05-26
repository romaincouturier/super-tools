CREATE OR REPLACE FUNCTION public.get_learner_portal_training_details(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'email', lower(p_email),
    'trainings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'training_id',   t.id,
        'training_name', t.training_name,
        'start_date',    t.start_date,
        'end_date',      t.end_date,
        'location',      t.location,
        'training_type', t.training_type,
        'lms_course_id', t.supports_lms_course_id,
        'lms_completion', COALESCE((
          SELECT lp.completion_pct
          FROM lms_learner_progress lp
          WHERE lp.course_id = t.supports_lms_course_id
            AND lower(lp.learner_email) = lower(p_email)
          LIMIT 1
        ), 0),
        'last_lesson_id', (
          SELECT pv.lesson_id
          FROM lms_page_views pv
          WHERE pv.course_id = t.supports_lms_course_id
            AND lower(pv.learner_email) = lower(p_email)
          ORDER BY pv.viewed_at DESC
          LIMIT 1
        ),
        'next_event', (
          SELECT row_to_json(ev)
          FROM (
            SELECT lm.id, lm.title, lm.scheduled_at, lm.meeting_url, lm.meeting_type,
                   lm.duration_minutes, lm.description
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
        'coaching_sessions_completed', tp.coaching_sessions_completed,
        'coaching_sessions_total',     tp.coaching_sessions_total,
        'trainer_booking_url', (
          SELECT tr.booking_url FROM trainers tr WHERE tr.id = t.trainer_id
        )
      ) ORDER BY t.start_date DESC NULLS LAST)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(p_email)
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_learner_portal_training_details(text) TO anon, authenticated, service_role;