
-- Add file support to LMS lessons
ALTER TABLE public.lms_lessons ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.lms_lessons ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.lms_lessons ADD COLUMN IF NOT EXISTS file_size BIGINT;
