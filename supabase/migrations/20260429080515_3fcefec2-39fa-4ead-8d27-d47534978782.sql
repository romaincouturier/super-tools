ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS formal_address boolean NOT NULL DEFAULT false;

ALTER TABLE public.mission_contacts
  ADD COLUMN IF NOT EXISTS formal_address boolean NOT NULL DEFAULT false;