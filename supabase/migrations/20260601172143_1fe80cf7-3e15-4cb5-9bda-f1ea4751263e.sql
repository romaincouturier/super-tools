CREATE OR REPLACE FUNCTION public.get_staff_public_profiles()
RETURNS TABLE (email text, first_name text, last_name text, photo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, first_name, last_name, photo_url FROM public.profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_public_profiles() TO anon, authenticated;