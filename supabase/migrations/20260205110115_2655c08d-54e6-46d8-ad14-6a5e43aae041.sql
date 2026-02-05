-- Add emoji column to crm_cards table
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS emoji text;