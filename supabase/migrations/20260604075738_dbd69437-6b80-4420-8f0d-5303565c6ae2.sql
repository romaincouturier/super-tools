WITH ranked AS (
  SELECT id, survey_id,
         ROW_NUMBER() OVER (PARTITION BY survey_id ORDER BY created_at ASC, position ASC) AS rn
  FROM public.mission_survey_questions
  WHERE label = 'Expression libre, vous avez quelque chose à ajouter ? À préciser ?'
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.mission_survey_questions WHERE id IN (SELECT id FROM to_delete);