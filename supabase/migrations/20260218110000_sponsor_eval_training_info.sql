-- Add training info directly in sponsor_cold_evaluations
-- so that anonymous users don't need to query the trainings table
ALTER TABLE public.sponsor_cold_evaluations
ADD COLUMN IF NOT EXISTS training_name TEXT,
ADD COLUMN IF NOT EXISTS training_start_date DATE,
ADD COLUMN IF NOT EXISTS training_end_date DATE;
