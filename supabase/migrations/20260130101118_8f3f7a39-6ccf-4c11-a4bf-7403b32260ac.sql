-- Add sponsor/commanditaire fields to trainings table
ALTER TABLE public.trainings
ADD COLUMN sponsor_first_name text,
ADD COLUMN sponsor_last_name text,
ADD COLUMN sponsor_email text;