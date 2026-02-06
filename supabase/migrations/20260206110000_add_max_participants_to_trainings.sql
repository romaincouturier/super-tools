-- Add max_participants column to trainings table
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 0;

COMMENT ON COLUMN public.trainings.max_participants IS 'Maximum number of participants allowed for this training. Convention generation is blocked when set to 0.';
