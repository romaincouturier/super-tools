ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS logistics_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS logistics_email_sent_to text;