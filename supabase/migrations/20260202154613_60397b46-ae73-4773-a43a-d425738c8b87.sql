-- Add columns to track train and hotel reservations
ALTER TABLE public.trainings 
ADD COLUMN train_booked BOOLEAN DEFAULT false,
ADD COLUMN hotel_booked BOOLEAN DEFAULT false;