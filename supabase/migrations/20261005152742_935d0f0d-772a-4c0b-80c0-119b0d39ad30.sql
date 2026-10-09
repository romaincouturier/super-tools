INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('contact_email', 'contact@supertilt.fr', 'Adresse de contact affichée aux apprenants et clients')
ON CONFLICT (setting_key) DO NOTHING;

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
      'qualiopi_certificate_path',
      'maintenance_banner_enabled',
      'maintenance_banner_message',
      'contact_email'
    );
$function$;