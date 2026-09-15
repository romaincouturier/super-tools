CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user = 'service_role';
$$;

GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;

ALTER FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) OWNER TO postgres;
ALTER FUNCTION public.restore_lesson_version(uuid) OWNER TO postgres;