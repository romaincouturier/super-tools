-- Add specific_instructions field to trainings
-- These instructions appear in Google Calendar event descriptions and the training summary page
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS specific_instructions TEXT;

-- Update the public RPC to include specific_instructions
CREATE OR REPLACE FUNCTION public.get_training_summary_info(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id, 'training_name', training_name, 'client_name', client_name,
    'start_date', start_date, 'end_date', end_date, 'location', location,
    'program_file_url', program_file_url, 'supports_url', supports_url,
    'trainer_id', trainer_id, 'objectives', objectives, 'prerequisites', prerequisites,
    'format_formation', format_formation, 'session_type', session_type,
    'session_format', session_format, 'specific_instructions', specific_instructions
  ) FROM trainings WHERE id = p_training_id;
$$;
