-- trainings: only staff can create
DROP POLICY IF EXISTS "Authenticated users can create trainings" ON public.trainings;
CREATE POLICY "trainings_insert_staff"
ON public.trainings FOR INSERT TO authenticated
WITH CHECK (public.is_staff_user() AND created_by = auth.uid());

-- training_evaluations: remove ownership-only insert path
DROP POLICY IF EXISTS "Users can create evaluations for their trainings" ON public.training_evaluations;
CREATE POLICY "training_evaluations_insert_staff"
ON public.training_evaluations FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff_user()
  OR public.has_module_access(auth.uid(), 'evaluations')
  OR public.has_module_access(auth.uid(), 'formations')
);

-- program_files: staff-only writes, matching staff-only reads
DROP POLICY IF EXISTS "Authenticated users can upload program files" ON public.program_files;
CREATE POLICY "program_files_insert_staff"
ON public.program_files FOR INSERT TO authenticated
WITH CHECK (public.is_staff_user() AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can delete their program files" ON public.program_files;
CREATE POLICY "program_files_delete_staff"
ON public.program_files FOR DELETE TO authenticated
USING (public.is_staff_user());