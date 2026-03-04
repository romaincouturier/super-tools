-- Add formula_id to trainings table so a permanent session can be linked to a specific formula
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS formula_id UUID REFERENCES public.formation_formulas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainings_formula_id
ON public.trainings(formula_id)
WHERE formula_id IS NOT NULL;
