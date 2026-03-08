
-- Additional RPC functions for public page migration to secure access

-- Mark attendance signature as opened (for Emargement page)
CREATE OR REPLACE FUNCTION public.mark_attendance_opened(p_token text, p_timestamp text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE attendance_signatures SET email_opened_at = p_timestamp::timestamptz
  WHERE token = p_token AND email_opened_at IS NULL;
END; $$;

-- Mark convention signature as opened (for SignatureConvention page)
CREATE OR REPLACE FUNCTION public.mark_convention_opened(p_token text, p_timestamp text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE convention_signatures SET email_opened_at = p_timestamp::timestamptz
  WHERE token = p_token AND email_opened_at IS NULL;
END; $$;

-- Mark devis signature as opened (for SignatureDevis page)
CREATE OR REPLACE FUNCTION public.mark_devis_opened(p_token text, p_timestamp text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE devis_signatures SET email_opened_at = p_timestamp::timestamptz
  WHERE token = p_token AND email_opened_at IS NULL;
END; $$;

-- Extended training info for TrainingSummary page
CREATE OR REPLACE FUNCTION public.get_training_summary_info(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id, 'training_name', training_name, 'client_name', client_name,
    'start_date', start_date, 'end_date', end_date, 'location', location,
    'program_file_url', program_file_url, 'supports_url', supports_url,
    'trainer_id', trainer_id, 'objectives', objectives, 'prerequisites', prerequisites,
    'format_formation', format_formation, 'session_type', session_type,
    'session_format', session_format
  ) FROM trainings WHERE id = p_training_id;
$$;

-- Public trainer info
CREATE OR REPLACE FUNCTION public.get_trainer_public(p_trainer_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id, 'first_name', first_name, 'last_name', last_name,
    'email', email, 'phone', phone, 'photo_url', photo_url,
    'linkedin_url', linkedin_url, 'cv_url', cv_url
  ) FROM trainers WHERE id = p_trainer_id;
$$;

-- Public app setting value
CREATE OR REPLACE FUNCTION public.get_app_setting_public(p_key text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT setting_value FROM app_settings WHERE setting_key = p_key;
$$;

-- Get training schedule for specific date (for Emargement)
CREATE OR REPLACE FUNCTION public.get_training_schedule_for_date(p_training_id uuid, p_day_date text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('start_time', start_time, 'end_time', end_time)
  FROM training_schedules
  WHERE training_id = p_training_id AND day_date = p_day_date::date
  LIMIT 1;
$$;
