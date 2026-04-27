-- Fix the anonymous-read RLS policy for lms_lesson_blocks shipped in
-- 20260427133703_add_lms_lesson_blocks.sql.
--
-- The original policy compared lms_courses.is_published (boolean), but the
-- column is actually lms_courses.status (text, value 'published'), as used by
-- every other LMS anon policy in 20260321130000_fix_rls_anon_policies.sql.
-- The mismatched JOIN condition was always false, so anonymous learners
-- could not read any lesson block — every published course appeared empty
-- in the player.

DROP POLICY IF EXISTS "anon_read_lesson_blocks" ON public.lms_lesson_blocks;

CREATE POLICY "anon_read_lesson_blocks"
  ON public.lms_lesson_blocks
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1
    FROM public.lms_lessons l
    JOIN public.lms_modules m ON m.id = l.module_id
    JOIN public.lms_courses c ON c.id = m.course_id
    WHERE l.id = lms_lesson_blocks.lesson_id
      AND c.status = 'published'
  ));
