-- Expertise et mise en avant des formations du catalogue (recommandations apprenant)
ALTER TABLE public.formation_configs
  ADD COLUMN IF NOT EXISTS expertise text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
