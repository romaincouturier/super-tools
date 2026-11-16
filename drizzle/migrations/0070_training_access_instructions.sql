ALTER TABLE public.training_venues ADD COLUMN IF NOT EXISTS access_instructions text;
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS access_instructions text;
COMMENT ON COLUMN public.trainings.access_instructions IS 'Session override; null or blank inherits training_venues.access_instructions.';
COMMENT ON COLUMN public.training_venues.access_instructions IS 'Reusable physical venue access instructions for participant emails.';