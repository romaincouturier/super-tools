-- Add supports_url column to trainings table for storing the link to training materials
ALTER TABLE public.trainings
ADD COLUMN supports_url text;