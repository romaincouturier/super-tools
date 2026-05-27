ALTER TABLE public.practice_posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS practice_posts_pinned_idx
  ON public.practice_posts (is_pinned DESC, created_at DESC);
