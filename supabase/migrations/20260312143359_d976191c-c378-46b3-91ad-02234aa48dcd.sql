GRANT EXECUTE ON FUNCTION public.get_attendance_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_attendance_opened(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_training_public_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_participant_public_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_training_schedule_for_date(uuid, text) TO anon;