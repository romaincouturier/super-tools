-- Add 'finances' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'finances';

-- Seed the Pennylane token setting (empty by default)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('pennylane_api_token', '', 'Token API Pennylane (Bearer token v2) pour récupérer les factures clients/fournisseurs et la trésorerie')
ON CONFLICT (setting_key) DO NOTHING;