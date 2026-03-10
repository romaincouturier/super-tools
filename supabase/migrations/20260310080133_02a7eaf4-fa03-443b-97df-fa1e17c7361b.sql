ALTER TABLE public.sponsor_cold_evaluations 
  ADD COLUMN IF NOT EXISTS training_name text,
  ADD COLUMN IF NOT EXISTS training_start_date text,
  ADD COLUMN IF NOT EXISTS training_end_date text;