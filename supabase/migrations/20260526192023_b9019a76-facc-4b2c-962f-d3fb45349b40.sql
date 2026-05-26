
CREATE OR REPLACE FUNCTION public.get_course_training_sessions_admin(p_course_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(row ORDER BY (row->'training'->>'start_date') ASC NULLS LAST)
    FROM (
      SELECT json_build_object(
        'training', json_build_object(
          'id',            t.id,
          'start_date',    t.start_date,
          'end_date',      t.end_date,
          'training_name', t.training_name
        ),
        'meetings', COALESCE((
          SELECT json_agg(json_build_object(
            'id',               lm.id,
            'title',            lm.title,
            'scheduled_at',     lm.scheduled_at,
            'duration_minutes', lm.duration_minutes,
            'meeting_url',      lm.meeting_url,
            'meeting_type',     lm.meeting_type,
            'status',           lm.status,
            'description',      lm.description,
            'replay_url',       lm.replay_url
          ) ORDER BY lm.scheduled_at ASC)
          FROM training_live_meetings lm
          WHERE lm.training_id = t.id
            AND lm.status <> 'cancelled'
        ), '[]'::json)
      ) AS row
      FROM trainings t
      WHERE t.supports_lms_course_id = p_course_id
        AND COALESCE(t.is_cancelled, false) = false
        AND (
          t.end_date IS NULL
          OR t.end_date >= current_date
          OR t.start_date >= current_date
        )
    ) s
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_training_sessions_admin(uuid) TO authenticated;
