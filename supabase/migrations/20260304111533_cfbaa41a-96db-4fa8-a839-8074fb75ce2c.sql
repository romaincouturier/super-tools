-- Add formula_id column
ALTER TABLE public.training_participants
ADD COLUMN IF NOT EXISTS formula_id UUID REFERENCES public.formation_formulas(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_training_participants_formula_id
ON public.training_participants(formula_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';