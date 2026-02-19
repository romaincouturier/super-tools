-- Add catalog_id foreign key to trainings table
-- Nullable for backward compatibility with existing trainings

ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.formation_configs(id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_trainings_catalog_id ON public.trainings(catalog_id);
