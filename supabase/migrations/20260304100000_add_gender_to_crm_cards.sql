-- Add gender column to crm_cards for M./Mme salutation
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('M', 'Mme'));
