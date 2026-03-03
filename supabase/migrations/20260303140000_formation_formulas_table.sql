-- ===========================================
-- Formation Formulas: Individual formula definitions
-- ===========================================
-- Replace the hardcoded available_formulas TEXT[] on formation_configs
-- with a dedicated table where each formula has its own properties.

-- 1. Create formation_formulas table
CREATE TABLE public.formation_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_config_id UUID NOT NULL REFERENCES public.formation_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duree_heures NUMERIC,
  prix NUMERIC,
  elearning_access_email_content TEXT,
  woocommerce_product_id INTEGER,
  supports_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage formation_formulas"
ON public.formation_formulas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_formation_formulas_config ON public.formation_formulas(formation_config_id);

CREATE TRIGGER update_formation_formulas_updated_at
BEFORE UPDATE ON public.formation_formulas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Migrate existing available_formulas data into new table
-- Map keys to display names during migration
INSERT INTO public.formation_formulas (formation_config_id, name, display_order)
SELECT
  fc.id,
  CASE f.val
    WHEN 'solo' THEN 'Solo'
    WHEN 'communaute' THEN 'Communauté'
    WHEN 'coachee' THEN 'Coachée'
    ELSE f.val
  END,
  f.idx - 1
FROM public.formation_configs fc,
LATERAL unnest(fc.available_formulas) WITH ORDINALITY AS f(val, idx)
WHERE fc.available_formulas IS NOT NULL
  AND array_length(fc.available_formulas, 1) > 0;

-- 3. Drop the CHECK constraint on training_participants.formula
-- so it can store any formula name (not just hardcoded keys)
ALTER TABLE public.training_participants DROP CONSTRAINT IF EXISTS training_participants_formula_check;

-- 4. Migrate existing participant formula values to display names
UPDATE public.training_participants SET formula = 'Solo' WHERE formula = 'solo';
UPDATE public.training_participants SET formula = 'Communauté' WHERE formula = 'communaute';
UPDATE public.training_participants SET formula = 'Coachée' WHERE formula = 'coachee';
