
-- 1. Table de liaison sessions <-> formules
CREATE TABLE IF NOT EXISTS public.training_formulas (
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  formula_id  UUID NOT NULL REFERENCES public.formation_formulas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (training_id, formula_id)
);

CREATE INDEX IF NOT EXISTS idx_training_formulas_formula ON public.training_formulas(formula_id);
CREATE INDEX IF NOT EXISTS idx_training_formulas_training ON public.training_formulas(training_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_formulas TO authenticated;
GRANT ALL ON public.training_formulas TO service_role;

ALTER TABLE public.training_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_formulas read for authenticated"
ON public.training_formulas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "training_formulas write for formations module"
ON public.training_formulas FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 2. Trigger d'exclusivité : permanent xor programmé pour une même formule
CREATE OR REPLACE FUNCTION public.enforce_formula_session_exclusivity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_is_permanent BOOLEAN;
  v_conflict_count   INT;
BEGIN
  SELECT (start_date IS NULL) INTO v_new_is_permanent
  FROM public.trainings WHERE id = NEW.training_id;

  IF v_new_is_permanent THEN
    -- nouvelle liaison vers une permanente : interdire si la formule est déjà liée à une session datée
    SELECT count(*) INTO v_conflict_count
    FROM public.training_formulas tf
    JOIN public.trainings t ON t.id = tf.training_id
    WHERE tf.formula_id = NEW.formula_id
      AND tf.training_id <> NEW.training_id
      AND t.start_date IS NOT NULL;

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Cette formule est déjà liée à une session programmée. Une formule ne peut pas être à la fois en session permanente et en session programmée.';
    END IF;

    -- une formule ne peut être liée qu'à UNE seule session permanente
    SELECT count(*) INTO v_conflict_count
    FROM public.training_formulas tf
    JOIN public.trainings t ON t.id = tf.training_id
    WHERE tf.formula_id = NEW.formula_id
      AND tf.training_id <> NEW.training_id
      AND t.start_date IS NULL;

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Cette formule est déjà liée à une session permanente. Détachez-la d''abord.';
    END IF;
  ELSE
    -- nouvelle liaison vers une session datée : interdire si la formule est déjà liée à une permanente
    SELECT count(*) INTO v_conflict_count
    FROM public.training_formulas tf
    JOIN public.trainings t ON t.id = tf.training_id
    WHERE tf.formula_id = NEW.formula_id
      AND tf.training_id <> NEW.training_id
      AND t.start_date IS NULL;

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Cette formule est déjà liée à une session permanente. Une formule ne peut pas être à la fois en session permanente et en session programmée.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_formula_session_exclusivity ON public.training_formulas;
CREATE TRIGGER trg_enforce_formula_session_exclusivity
BEFORE INSERT OR UPDATE ON public.training_formulas
FOR EACH ROW EXECUTE FUNCTION public.enforce_formula_session_exclusivity();

-- 3. Backfill depuis les participants existants (ignore les conflits d'exclusivité)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT tp.training_id, tp.formula_id
    FROM public.training_participants tp
    WHERE tp.formula_id IS NOT NULL AND tp.training_id IS NOT NULL
  LOOP
    BEGIN
      INSERT INTO public.training_formulas (training_id, formula_id)
      VALUES (r.training_id, r.formula_id)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip backfill % / % : %', r.training_id, r.formula_id, SQLERRM;
    END;
  END LOOP;
END $$;
