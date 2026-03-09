ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS waiting_next_action_date date;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS waiting_next_action_text text;