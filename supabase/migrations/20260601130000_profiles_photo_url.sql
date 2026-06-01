-- Add photo_url to staff profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url text NULL;
