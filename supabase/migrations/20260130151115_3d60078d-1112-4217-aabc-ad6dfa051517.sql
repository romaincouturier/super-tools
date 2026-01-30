-- Add trainer_name column to trainings table with default value
ALTER TABLE public.trainings 
ADD COLUMN trainer_name text NOT NULL DEFAULT 'Romain Couturier';