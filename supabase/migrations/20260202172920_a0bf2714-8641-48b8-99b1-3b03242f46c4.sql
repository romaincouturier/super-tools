-- Add restaurant_booked column to trainings table
ALTER TABLE public.trainings 
ADD COLUMN restaurant_booked boolean DEFAULT null;