
-- Add column to store uploaded signed convention files
ALTER TABLE public.trainings
ADD COLUMN signed_convention_urls TEXT[] DEFAULT '{}';
