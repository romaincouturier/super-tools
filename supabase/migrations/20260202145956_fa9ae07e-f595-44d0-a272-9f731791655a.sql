-- Add first_name and last_name columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text;