-- Add SuperTilt link field to trainings table
ALTER TABLE public.trainings
ADD COLUMN supertilt_link text;