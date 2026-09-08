ALTER TABLE public.pictodico_words
  ADD COLUMN IF NOT EXISTS is_chosen boolean NOT NULL DEFAULT false;

ALTER TABLE public.pictodico_challenges
  ADD COLUMN IF NOT EXISTS theme_description text,
  ADD COLUMN IF NOT EXISTS challenge_time time NOT NULL DEFAULT '09:00';