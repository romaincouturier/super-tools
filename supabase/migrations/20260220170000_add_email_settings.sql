-- Add sender_email and sender_name to app_settings
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('sender_email', 'romain@supertilt.fr', 'Adresse email de l''expéditeur pour tous les envois')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('sender_name', 'Romain Couturier', 'Nom de l''expéditeur pour tous les envois')
ON CONFLICT (setting_key) DO NOTHING;

-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Set existing admin
UPDATE public.profiles SET is_admin = true WHERE email = 'romain@supertilt.fr';

-- Update is_admin function to use profiles table instead of hardcoded email
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND is_admin = true
  );
$$;

-- Public function to check if an email is allowed to self-register
CREATE OR REPLACE FUNCTION public.is_signup_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(email) = lower(p_email)
      AND is_admin = true
  );
$$;

-- Grant execute to anon role so unauthenticated users can check at signup
GRANT EXECUTE ON FUNCTION public.is_signup_allowed(text) TO anon;

-- Public function to get contact info (for public pages like questionnaire)
CREATE OR REPLACE FUNCTION public.get_public_contact()
RETURNS TABLE(email text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT setting_value FROM public.app_settings WHERE setting_key = 'sender_email'),
      (SELECT setting_value FROM public.app_settings WHERE setting_key = 'bcc_email')
    ) AS email,
    COALESCE(
      (SELECT setting_value FROM public.app_settings WHERE setting_key = 'sender_name'),
      'Supertilt'
    ) AS name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_contact() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_contact() TO authenticated;
