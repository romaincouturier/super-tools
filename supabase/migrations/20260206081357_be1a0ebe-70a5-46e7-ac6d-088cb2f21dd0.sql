-- Add sold price HT to trainings
ALTER TABLE public.trainings 
ADD COLUMN sold_price_ht NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.trainings.sold_price_ht IS 'Prix HT vendu. Pour intra: prix global. Pour inter: prix par participant.';

-- Add default TVA rate in app_settings (20%)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('tva_rate', '20', 'Taux de TVA par défaut en pourcentage (ex: 20 pour 20%)')
ON CONFLICT (setting_key) DO NOTHING;