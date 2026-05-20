-- Étape 1 : reporter training.elearning_duration → formation_formulas.duree_heures
-- pour les formules qui n'ont pas encore de durée définie.
-- Cela préserve les durées actuellement configurées par formation.
UPDATE public.formation_formulas ff
SET duree_heures = subq.duration
FROM (
  SELECT
    ff2.id AS formula_id,
    t.elearning_duration AS duration
  FROM public.formation_formulas ff2
  JOIN public.formation_configs fc ON fc.id = ff2.formation_config_id
  JOIN public.trainings t ON t.catalog_id = fc.id
  WHERE ff2.duree_heures IS NULL
    AND t.elearning_duration IS NOT NULL
) subq
WHERE ff.id = subq.formula_id;

-- Étape 2 : supprimer les colonnes devenues redondantes
ALTER TABLE public.training_participants DROP COLUMN IF EXISTS elearning_duration;
ALTER TABLE public.trainings DROP COLUMN IF EXISTS elearning_duration;
ALTER TABLE public.formation_configs DROP COLUMN IF EXISTS elearning_duration;
