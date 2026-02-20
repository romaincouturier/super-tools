-- Function to check if a user exists by email in the auth system
-- Used by the log-login-attempt edge function to detect unauthorized login attempts
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(target_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(target_email)
  );
$$;

-- Only allow service role (edge functions) to call this function
REVOKE ALL ON FUNCTION public.check_user_exists_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_exists_by_email(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.check_user_exists_by_email(text) FROM anon;
