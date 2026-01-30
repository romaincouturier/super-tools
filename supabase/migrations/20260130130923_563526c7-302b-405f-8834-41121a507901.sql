-- Add sponsor_formal_address column to trainings table
-- Default to true (vouvoiement) as requested
ALTER TABLE public.trainings 
ADD COLUMN sponsor_formal_address boolean NOT NULL DEFAULT true;