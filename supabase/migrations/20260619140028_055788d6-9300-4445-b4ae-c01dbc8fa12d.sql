ALTER TABLE public.formation_dates
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location text;