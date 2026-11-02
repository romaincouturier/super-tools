ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS training_followup jsonb;
ALTER TABLE public.quote_settings ADD COLUMN IF NOT EXISTS default_followup_hourly_rate numeric NOT NULL DEFAULT 150;
ALTER TABLE public.quote_settings ADD COLUMN IF NOT EXISTS hourly_price_alert_threshold numeric NOT NULL DEFAULT 60;