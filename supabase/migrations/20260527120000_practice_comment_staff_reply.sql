-- Denormalize staff (trainer) reply identity onto community comments.
-- Learners cannot read the staff `profiles` table (RLS restricts it to admins
-- and self), so to display a trainer's name + badge on their replies we store
-- the resolved display name and a staff flag at write time.

ALTER TABLE public.practice_post_comments
  ADD COLUMN IF NOT EXISTS author_display_name text,
  ADD COLUMN IF NOT EXISTS is_staff_reply boolean NOT NULL DEFAULT false;
