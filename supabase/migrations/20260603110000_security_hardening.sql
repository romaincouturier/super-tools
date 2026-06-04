-- is_staff_user() : add SECURITY DEFINER + fixed search_path to prevent
-- path-manipulation attacks in restrictive policies.
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'learner',
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
