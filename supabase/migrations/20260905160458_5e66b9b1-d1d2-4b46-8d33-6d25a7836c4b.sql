CREATE OR REPLACE FUNCTION public.get_training_public_info(p_training_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object('training_name', training_name, 'start_date', start_date, 'end_date', end_date, 'prerequisites', prerequisites, 'program_file_url', program_file_url, 'format_formation', format_formation, 'location', location, 'objectives', objectives, 'session_type', session_type, 'client_name', client_name)
  FROM trainings WHERE id = p_training_id;
$function$;