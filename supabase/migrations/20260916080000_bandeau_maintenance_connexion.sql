-- Bandeau d'information sur les écrans de connexion.
-- Pendant la migration de la connexion apprenant, mieux vaut prévenir sur place
-- que d'écrire à toute la base : le message ne touche que les personnes qui se
-- connectent, au moment où une gêne peut survenir.
--
-- Deux réglages, pilotés depuis Paramètres généraux : l'affichage et le texte.

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'maintenance_banner_enabled',
  'false',
  'Affiche un bandeau d''information sur les écrans de connexion ("true" ou "false")'
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'maintenance_banner_message',
  'Nous faisons évoluer notre plateforme. Pendant cette phase de tests et de migration, vous pourriez rencontrer ponctuellement quelques difficultés d''accès. Nous faisons au mieux pour que cette période soit la plus courte et la plus discrète possible. Merci pour votre patience et votre compréhension.',
  'Texte du bandeau d''information affiché sur les écrans de connexion'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Les écrans de connexion s'affichent sans session : la lecture passe par la
-- fonction publique, dont la liste blanche s'ouvre à ces deux clés et à rien
-- d'autre.
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
      'maintenance_banner_message'
    );
$function$;
