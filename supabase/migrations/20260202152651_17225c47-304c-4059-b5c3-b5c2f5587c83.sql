-- Add 'parametres' to the app_module enum for access control
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'parametres';