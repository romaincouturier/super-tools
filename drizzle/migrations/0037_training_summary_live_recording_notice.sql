CREATE OR REPLACE FUNCTION public.get_training_summary_info(p_training_id uuid)
 RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', t.id, 'training_name', t.training_name, 'client_name', t.client_name,
    'start_date', t.start_date, 'end_date', t.end_date, 'location', t.location,
    'program_file_url', t.program_file_url, 'supports_url', t.supports_url,
    'supports_type', t.supports_type, 'supports_lms_course_id', t.supports_lms_course_id,
    'trainer_id', t.trainer_id, 'objectives', t.objectives, 'prerequisites', t.prerequisites,
    'format_formation', t.format_formation, 'session_type', t.session_type,
    'session_format', t.session_format,
    'participants_formal_address', t.participants_formal_address,
    'has_lives', EXISTS (SELECT 1 FROM training_live_meetings l WHERE l.training_id = t.id AND l.status IS DISTINCT FROM 'cancelled'),
    'live_recording_notice', (
      SELECT e.html_content FROM email_templates e
      WHERE e.template_type IN (
        'live_recording_notice_' || CASE WHEN t.participants_formal_address IS FALSE THEN 'tu' ELSE 'vous' END,
        'live_recording_notice')
      ORDER BY e.template_type DESC LIMIT 1)
  ) FROM trainings t WHERE t.id = p_training_id;
$function$;