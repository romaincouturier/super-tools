ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS sponsor_phone TEXT;
ALTER TABLE public.training_participants ADD COLUMN IF NOT EXISTS sponsor_phone TEXT;