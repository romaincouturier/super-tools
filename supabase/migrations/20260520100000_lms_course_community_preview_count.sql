-- Add configurable community preview post count to lms_courses.
-- Default is 2 posts shown in the course home sidebar.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS community_preview_count INTEGER NOT NULL DEFAULT 2;
