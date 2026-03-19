-- Add voice_description to profiles for per-user editorial voice
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_description TEXT DEFAULT '';
