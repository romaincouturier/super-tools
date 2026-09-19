-- Dépôts libres (portfolio, lesson_id NULL) : la policy d'insertion exigeait une
-- leçon correspondante, donc aucun dépôt libre ne pouvait passer. On autorise
-- lesson_id NULL en conservant l'exigence d'inscription au cours.
DROP POLICY IF EXISTS auth_learner_insert_work_deposits ON public.lms_work_deposits;
CREATE POLICY auth_learner_insert_work_deposits ON public.lms_work_deposits
FOR INSERT TO authenticated
WITH CHECK (
  lower(learner_email) = get_learner_email()
  AND course_id IS NOT NULL
  AND lms_learner_is_enrolled(course_id)
  AND (
    lesson_id IS NULL
    OR EXISTS (SELECT 1 FROM lms_lessons l WHERE l.id = lms_work_deposits.lesson_id AND l.work_deposit_enabled = true)
    OR EXISTS (SELECT 1 FROM lms_lesson_blocks b WHERE b.lesson_id = lms_work_deposits.lesson_id AND b.type = 'work_deposit' AND NOT b.hidden)
    OR EXISTS (SELECT 1 FROM lms_lesson_blocks b WHERE b.lesson_id = lms_work_deposits.lesson_id AND b.type = 'exercise' AND NOT b.hidden AND (b.content ->> 'work_deposit_enabled')::boolean = true)
  )
);

-- Reliquat de l'ère lien magique : plus aucun dépôt anonyme.
DROP POLICY IF EXISTS anon_insert_work_deposits ON public.lms_work_deposits;
