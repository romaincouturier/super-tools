-- Add objectives column to trainings table
ALTER TABLE public.trainings 
ADD COLUMN objectives text[] DEFAULT '{}'::text[];