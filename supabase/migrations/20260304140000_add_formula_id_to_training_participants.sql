-- Add formula_id column to training_participants for robust formula lookups (instead of name-based matching)
ALTER TABLE public.training_participants
ADD COLUMN IF NOT EXISTS formula_id UUID REFERENCES public.formation_formulas(id) ON DELETE SET NULL;

-- Populate formula_id from existing formula name + training's catalog_id
UPDATE public.training_participants tp
SET formula_id = ff.id
FROM public.trainings t
JOIN public.formation_formulas ff
  ON ff.formation_config_id = t.catalog_id
  AND ff.name = tp.formula
WHERE tp.training_id = t.id
  AND tp.formula IS NOT NULL
  AND tp.formula_id IS NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_training_participants_formula_id
ON public.training_participants(formula_id);
