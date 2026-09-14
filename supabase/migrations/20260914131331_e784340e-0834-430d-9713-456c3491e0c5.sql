-- 1. Learner own-row access for authenticated learner accounts (not only anon/magic-link)
DROP POLICY IF EXISTS "learner_read_own_learner_profile" ON public.learner_profiles;
DROP POLICY IF EXISTS "learner_insert_own_learner_profile" ON public.learner_profiles;
DROP POLICY IF EXISTS "learner_update_own_learner_profile" ON public.learner_profiles;

CREATE POLICY "learner_read_own_learner_profile"
ON public.learner_profiles FOR SELECT TO authenticated
USING (lower(email) = public.get_learner_email());

CREATE POLICY "learner_insert_own_learner_profile"
ON public.learner_profiles FOR INSERT TO authenticated
WITH CHECK (lower(email) = public.get_learner_email());

CREATE POLICY "learner_update_own_learner_profile"
ON public.learner_profiles FOR UPDATE TO authenticated
USING (lower(email) = public.get_learner_email())
WITH CHECK (lower(email) = public.get_learner_email());

-- 2. Restrict the public app setting reader to a safe whitelist
CREATE OR REPLACE FUNCTION public.get_app_setting_public(p_key text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT setting_value
  FROM app_settings
  WHERE setting_key = p_key
    AND p_key IN (
      'reglement_interieur_url',
      'sentry_dsn',
      'app_url',
      'website_url',
      'timezone',
      'qualiopi_certificate_path'
    );
$function$;