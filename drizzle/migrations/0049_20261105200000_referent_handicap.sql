-- Référent handicap désigné (indicateurs 26 et 1).
--
-- Les deux écrans qui annonçaient « notre référent handicap » affichaient en
-- réalité l'expéditeur générique des emails : personne n'était désigné, et
-- rien dans l'application ne portait cette désignation. Le référentiel attend
-- un interlocuteur identifié, joignable, et communiqué au public.
--
-- Trois réglages plutôt qu'une table : c'est un rôle unique dans l'organisme,
-- pas une collection. Ils sont modifiables dans Paramètres sans redéploiement.
--
-- Additive et idempotente : ON CONFLICT DO NOTHING ne réécrit jamais une
-- valeur déjà saisie.

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('referent_handicap_name', 'Romain Couturier', 'Nom du référent handicap désigné (indicateur 26)'),
  ('referent_handicap_email', 'romain@supertilt.fr', 'Adresse du référent handicap, communiquée au public'),
  ('referent_handicap_phone', '', 'Téléphone du référent handicap, facultatif'),
  ('referent_handicap_designated_at', '2026-11-05', 'Date de désignation du référent handicap')
ON CONFLICT (setting_key) DO NOTHING;

-- Les pages publiques (recueil des besoins, politique de confidentialité)
-- doivent pouvoir lire ces trois valeurs sans compte. La liste blanche de
-- get_app_setting_public reste la seule porte ouverte sur app_settings.
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
      'contact_email',
      'referent_handicap_name',
      'referent_handicap_email',
      'referent_handicap_phone'
    );
$function$;
