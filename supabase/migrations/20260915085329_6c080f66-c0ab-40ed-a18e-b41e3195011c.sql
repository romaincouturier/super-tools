DROP POLICY IF EXISTS "staff_select_snapshots" ON public.lms_lesson_snapshots;
DROP POLICY IF EXISTS "staff_insert_snapshots" ON public.lms_lesson_snapshots;
DROP POLICY IF EXISTS "staff_delete_snapshots" ON public.lms_lesson_snapshots;

CREATE POLICY "staff_select_snapshots"
  ON public.lms_lesson_snapshots
  FOR SELECT TO authenticated
  USING (is_staff_user());

CREATE POLICY "staff_insert_snapshots"
  ON public.lms_lesson_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (is_staff_user());

CREATE POLICY "staff_delete_snapshots"
  ON public.lms_lesson_snapshots
  FOR DELETE TO authenticated
  USING (is_staff_user());