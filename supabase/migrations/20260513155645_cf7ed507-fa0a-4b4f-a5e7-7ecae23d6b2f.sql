INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('slack_content_channel', 'publications-réso-sociaux')
ON CONFLICT (setting_key) DO NOTHING;