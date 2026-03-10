-- Add logistics booking columns to events (for internal physical events)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS train_booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hotel_booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_rental_booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restaurant_booked BOOLEAN DEFAULT false;

-- Add cancellation columns to trainings (for inter-enterprise sessions)
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
