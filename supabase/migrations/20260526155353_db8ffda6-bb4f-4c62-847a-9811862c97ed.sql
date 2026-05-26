ALTER TABLE public.practice_posts
  ADD COLUMN IF NOT EXISTS course_id uuid NULL,
  ADD COLUMN IF NOT EXISTS lesson_id uuid NULL;

CREATE INDEX IF NOT EXISTS practice_posts_lesson_idx ON public.practice_posts (lesson_id);
CREATE INDEX IF NOT EXISTS practice_posts_course_idx ON public.practice_posts (course_id);