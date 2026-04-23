CREATE OR REPLACE FUNCTION public.get_training_summary_info(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id, 'training_name', training_name, 'client_name', client_name,
    'start_date', start_date, 'end_date', end_date, 'location', location,
    'program_file_url', program_file_url, 'supports_url', supports_url,
    'supports_type', supports_type, 'supports_lms_course_id', supports_lms_course_id,
    'trainer_id', trainer_id, 'objectives', objectives, 'prerequisites', prerequisites,
    'format_formation', format_formation, 'session_type', session_type,
    'session_format', session_format
  ) FROM trainings WHERE id = p_training_id;
$$;