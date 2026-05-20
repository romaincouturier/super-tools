-- Adds optional file attachment fields to lms_forum_posts.
ALTER TABLE public.lms_forum_posts
  ADD COLUMN IF NOT EXISTS file_url  TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;
