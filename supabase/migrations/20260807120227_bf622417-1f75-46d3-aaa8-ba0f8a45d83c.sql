CREATE OR REPLACE FUNCTION public.learner_evaluation_course_id(p_email text, p_lms_course_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ff.learndash_course_id, fc.learndash_course_id)
  FROM public.training_participants tp
  JOIN public.trainings t ON t.id = tp.training_id
  LEFT JOIN public.formation_formulas ff ON ff.id = tp.formula_id
  LEFT JOIN public.formation_configs fc ON fc.id = t.catalog_id
  WHERE lower(tp.email) = lower(p_email)
    AND t.supports_lms_course_id = p_lms_course_id
    AND COALESCE(ff.learndash_course_id, fc.learndash_course_id) IS NOT NULL
  ORDER BY tp.added_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.learner_evaluation_course_id(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.learner_evaluation_course_id(text, uuid) TO anon, authenticated, service_role;