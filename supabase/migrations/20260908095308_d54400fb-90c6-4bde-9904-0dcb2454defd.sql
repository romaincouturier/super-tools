ALTER TABLE public.pictodico_challenges
  ADD COLUMN IF NOT EXISTS challenge_number integer,
  ADD COLUMN IF NOT EXISTS challenge_end_time time;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_time time;