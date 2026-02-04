-- Add reviewer_email column to content_reviews for easier email display
ALTER TABLE public.content_reviews ADD COLUMN IF NOT EXISTS reviewer_email TEXT;

-- Update existing records with known emails (if any)
-- This is a one-time fix for existing data
