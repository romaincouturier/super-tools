CREATE POLICY "auth_read_lesson_blocks_published"
ON public.lms_lesson_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM lms_lessons l
    JOIN lms_modules m ON m.id = l.module_id
    JOIN lms_courses c ON c.id = m.course_id
    WHERE l.id = lms_lesson_blocks.lesson_id
      AND c.status = 'published'
  )
);