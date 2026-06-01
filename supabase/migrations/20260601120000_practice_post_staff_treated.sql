-- Add staff_treated flag to practice_posts.
-- A post is marked treated when a staff member comments, reacts, or manually checks the box.
ALTER TABLE public.practice_posts ADD COLUMN IF NOT EXISTS is_staff_treated boolean NOT NULL DEFAULT false;
