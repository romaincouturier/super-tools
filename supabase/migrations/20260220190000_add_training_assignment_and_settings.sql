-- Add assigned_to column on trainings (references the app user who is responsible)
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add evaluation_notification_email setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('evaluation_notification_email', 'emmanuelle@supertilt.fr', 'Email qui reçoit les notifications de nouvelles évaluations')
ON CONFLICT (setting_key) DO NOTHING;

-- Add website_url setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('website_url', 'https://www.supertilt.fr', 'URL du site web principal')
ON CONFLICT (setting_key) DO NOTHING;

-- Add youtube_url setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('youtube_url', 'https://www.youtube.com/@supertilt', 'URL de la chaîne YouTube')
ON CONFLICT (setting_key) DO NOTHING;

-- Add blog_url setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('blog_url', 'https://supertilt.fr/blog/', 'URL du blog')
ON CONFLICT (setting_key) DO NOTHING;

-- Allow all authenticated users to view all profiles (needed for assignment selector)
-- Drop the old admin-only SELECT policy and replace with a broader one
DO $$
BEGIN
  -- Drop existing restrictive policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can view all profiles' AND tablename = 'profiles') THEN
    DROP POLICY "Admin can view all profiles" ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles') THEN
    DROP POLICY "Users can view own profile" ON public.profiles;
  END IF;
END $$;

-- All authenticated users can view all profiles (for user selectors)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');
