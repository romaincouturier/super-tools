-- Add funder fields to trainings table
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS financeur_same_as_sponsor boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS financeur_name text,
ADD COLUMN IF NOT EXISTS financeur_url text;