-- Add assigned_user_ids to content_columns for dynamic column-to-user assignments
ALTER TABLE public.content_columns
  ADD COLUMN IF NOT EXISTS assigned_user_ids TEXT[] NOT NULL DEFAULT '{}';

-- Seed existing hardcoded review column assignments
UPDATE public.content_columns
  SET assigned_user_ids = ARRAY['81d0328b-7651-4deb-95c0-c7ac81eb952e']
  WHERE id = '290ab277-6f1a-48b4-8641-d8b033d667de';

UPDATE public.content_columns
  SET assigned_user_ids = ARRAY['c894a7ec-4680-4a9e-bed7-4aad7af12909']
  WHERE id = '2ea6b47e-9d87-41d7-9eaa-95f57ba379da';
