-- Add column for manually uploaded signed convention
ALTER TABLE public.training_participants
ADD COLUMN signed_convention_url TEXT;