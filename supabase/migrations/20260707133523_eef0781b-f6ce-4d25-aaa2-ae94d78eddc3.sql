ALTER TABLE public.formation_configs
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

-- Update existing e_learning entries as a reasonable heuristic
UPDATE public.formation_configs
  SET is_permanent = true
  WHERE format_formation = 'e_learning';
