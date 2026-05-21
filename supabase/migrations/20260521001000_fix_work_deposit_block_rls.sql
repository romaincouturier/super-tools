-- ST-2026-0137: learner deposit INSERT fails when the lesson uses a
-- work_deposit block (lms_lesson_blocks) instead of the legacy
-- work_deposit_enabled flag on lms_lessons.
--
-- The old policy only checked l.work_deposit_enabled = true.
-- Now we also allow insert when the lesson has a non-hidden
-- work_deposit block, or an exercise block with work_deposit embedded
-- (ST-2026-0138).

DROP POLICY IF EXISTS "anon_insert_work_deposits" ON public.lms_work_deposits;

CREATE POLICY "anon_insert_work_deposits"
  ON public.lms_work_deposits
  FOR INSERT TO anon
  WITH CHECK (
    learner_email = get_learner_email()
    AND (
      -- Legacy: lesson-level work_deposit_enabled flag
      EXISTS (
        SELECT 1 FROM public.lms_lessons l
        WHERE l.id = lesson_id AND l.work_deposit_enabled = true
      )
      -- New: standalone work_deposit block
      OR EXISTS (
        SELECT 1 FROM public.lms_lesson_blocks b
        WHERE b.lesson_id = lesson_id
          AND b.type = 'work_deposit'
          AND NOT b.hidden
      )
      -- New: exercise block with embedded work deposit (ST-2026-0138)
      OR EXISTS (
        SELECT 1 FROM public.lms_lesson_blocks b
        WHERE b.lesson_id = lesson_id
          AND b.type = 'exercise'
          AND NOT b.hidden
          AND (b.content->>'work_deposit_enabled')::boolean = true
      )
    )
    AND lms_learner_is_enrolled(course_id)
  );
