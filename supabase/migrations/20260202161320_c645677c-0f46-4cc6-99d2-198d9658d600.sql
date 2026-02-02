-- Add sponsor fields per participant for inter-enterprise trainings
ALTER TABLE public.training_participants 
ADD COLUMN sponsor_first_name TEXT,
ADD COLUMN sponsor_last_name TEXT,
ADD COLUMN sponsor_email TEXT,
ADD COLUMN invoice_file_url TEXT;

-- Add a comment to explain the purpose
COMMENT ON COLUMN public.training_participants.sponsor_first_name IS 'Sponsor/commanditaire first name for inter-enterprise trainings';
COMMENT ON COLUMN public.training_participants.sponsor_last_name IS 'Sponsor/commanditaire last name for inter-enterprise trainings';
COMMENT ON COLUMN public.training_participants.sponsor_email IS 'Sponsor/commanditaire email for inter-enterprise trainings (used for invoicing)';
COMMENT ON COLUMN public.training_participants.invoice_file_url IS 'Per-participant invoice file URL for inter-enterprise trainings';