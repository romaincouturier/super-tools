-- Adds replay_url to training_live_meetings and an RPC for the learner portal.

ALTER TABLE public.training_live_meetings
  ADD COLUMN IF NOT EXISTS replay_url TEXT;

-- Returns meetings + training dates for a given lms_courses.id.
-- SECURITY DEFINER so learners (who lack direct access to trainings) can call it.
CREATE OR REPLACE FUNCTION public.get_course_live_meetings(p_course_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_training RECORD;
BEGIN
  SELECT id, start_date, end_date, training_name
  INTO v_training
  FROM trainings
  WHERE supports_lms_course_id = p_course_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('training', NULL, 'meetings', '[]'::json);
  END IF;

  RETURN json_build_object(
    'training', json_build_object(
      'id',            v_training.id,
      'start_date',    v_training.start_date,
      'end_date',      v_training.end_date,
      'training_name', v_training.training_name
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
      WHERE lm.training_id = v_training.id
        AND lm.status != 'cancelled'
    ), '[]'::json)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_course_live_meetings(uuid) TO anon, authenticated;
