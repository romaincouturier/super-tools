-- Add room_rental_booked column to trainings table
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS room_rental_booked boolean DEFAULT false;
