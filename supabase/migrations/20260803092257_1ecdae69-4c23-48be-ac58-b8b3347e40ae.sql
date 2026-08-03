INSERT INTO public.app_settings (setting_key, setting_value, updated_at)
VALUES ('gsc_site_url', 'https://supertilt.fr/', now())
ON CONFLICT (setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value,
              updated_at = now();