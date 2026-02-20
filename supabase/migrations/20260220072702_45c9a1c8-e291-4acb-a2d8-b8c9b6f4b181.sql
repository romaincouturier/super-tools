ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS confidence_score integer NULL;

NOTIFY pgrst, 'reload schema';