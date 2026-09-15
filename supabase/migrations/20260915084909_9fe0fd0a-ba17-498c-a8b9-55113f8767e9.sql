CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT current_user = 'service_role';
$$;

GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_service_role() FROM anon;