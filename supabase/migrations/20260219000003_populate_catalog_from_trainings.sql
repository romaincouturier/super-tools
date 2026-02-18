-- Populate formation_configs with objectives, prerequisites, and e-learning data
-- from the most recent training with the matching name.
-- Also set catalog_id on trainings that match a formation_config by name.

-- Step 1: Update formation_configs with data from the most recent matching training
UPDATE public.formation_configs fc
SET
  objectives = COALESCE(t.objectives, '{}'),
  prerequisites = COALESCE(t.prerequisites, '{}'),
  supertilt_link = t.supertilt_link,
  elearning_duration = t.elearning_duration,
  elearning_access_email_content = t.elearning_access_email_content
FROM (
  SELECT DISTINCT ON (training_name)
    training_name,
    objectives,
    prerequisites,
    supertilt_link,
    elearning_duration,
    elearning_access_email_content
  FROM public.trainings
  ORDER BY training_name, created_at DESC
) t
WHERE fc.formation_name = t.training_name;

-- Step 2: Link existing trainings to their catalog entry
UPDATE public.trainings tr
SET catalog_id = fc.id
FROM public.formation_configs fc
WHERE tr.training_name = fc.formation_name
  AND tr.catalog_id IS NULL;
