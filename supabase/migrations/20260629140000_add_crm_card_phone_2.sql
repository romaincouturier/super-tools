-- Opportunités CRM : 2e numéro de téléphone
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS phone_2 text;
