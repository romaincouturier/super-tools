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
        'training_id', t.id,
        'training_name', t.training_name,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'location', t.location,
        'format', t.format_formation,
        'participant_id', tp.id,
        'first_name', tp.first_name,
        'last_name', tp.last_name,
        'needs_survey_status', tp.needs_survey_status,
        'program_file_url', t.program_file_url,
        'supports_url', t.supports_url
      ) ORDER BY t.start_date DESC)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(p_email)
    ), '[]'::json),
    'questionnaires', COALESCE((
      SELECT json_agg(json_build_object(
        'token', q.token,
        'training_id', q.training_id,
        'etat', q.etat
      ))
      FROM questionnaire_besoins q
      WHERE lower(q.email) = lower(p_email)
    ), '[]'::json),
    'evaluations', COALESCE((
      SELECT json_agg(json_build_object(
        'token', e.token,
        'training_id', e.training_id,
        'etat', e.etat
      ))
      FROM training_evaluations e
      WHERE lower(e.email) = lower(p_email)
    ), '[]'::json)
  );
END;
$function$;