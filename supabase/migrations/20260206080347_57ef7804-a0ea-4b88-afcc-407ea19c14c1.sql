-- Add client_address column to trainings table
ALTER TABLE public.trainings 
ADD COLUMN client_address TEXT;