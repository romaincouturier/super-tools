UPDATE public.practice_posts p
SET course_id = sub.course_id
FROM (
  SELECT lower(tp.email) AS email,
         (array_agg(DISTINCT t.supports_lms_course_id))[1] AS course_id
  FROM public.training_participants tp
  JOIN public.trainings t ON t.id = tp.training_id
  WHERE t.supports_lms_course_id IS NOT NULL
  GROUP BY lower(tp.email)
  HAVING COUNT(DISTINCT t.supports_lms_course_id) = 1
) sub
WHERE p.course_id IS NULL
  AND lower(p.author_email) = sub.email;