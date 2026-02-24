-- Add logistics fields to missions (train, hotel, location)
-- Mirrors the existing functionality from trainings

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS train_booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hotel_booked BOOLEAN DEFAULT false;

COMMENT ON COLUMN missions.location IS 'Mission location (city/address) used for train/hotel booking links';
COMMENT ON COLUMN missions.train_booked IS 'Whether train has been booked for this mission';
COMMENT ON COLUMN missions.hotel_booked IS 'Whether hotel has been booked for this mission';
