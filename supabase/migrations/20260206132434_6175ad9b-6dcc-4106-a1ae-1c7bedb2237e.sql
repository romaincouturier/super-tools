-- Add missing values to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'emails';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'statistiques';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'crm';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'missions';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'okr';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'medias';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'monitoring';