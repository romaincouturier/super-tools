-- Add cv_url column to trainers table
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS cv_url text;
