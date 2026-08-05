INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'tender_ted_cpv_codes',
  '',
  'Codes CPV surveilles sur le TED. Vide = aucun : la prospection europeenne se fait sur les mots-cles seuls.'
)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = '';

UPDATE public.app_settings SET setting_value = '' WHERE setting_key = 'tender_ted_countries';

DELETE FROM public.app_settings WHERE setting_key = 'tender_ted_languages';