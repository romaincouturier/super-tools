-- Adds welcome_video_url and welcome_text to lms_courses
-- for customising the course home page hero section.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS welcome_video_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_text TEXT;
