
DROP POLICY IF EXISTS "Users can view their training evaluations" ON public.training_evaluations;
DROP POLICY IF EXISTS "Users can update their training evaluations" ON public.training_evaluations;
DROP POLICY IF EXISTS "Users can delete their training evaluations" ON public.training_evaluations;

CREATE POLICY "Users with evaluations access can view training evaluations"
ON public.training_evaluations FOR SELECT
USING (public.has_module_access(auth.uid(), 'evaluations') OR public.has_module_access(auth.uid(), 'formations'));

CREATE POLICY "Users with evaluations access can update training evaluations"
ON public.training_evaluations FOR UPDATE
USING (public.has_module_access(auth.uid(), 'evaluations') OR public.has_module_access(auth.uid(), 'formations'));

CREATE POLICY "Users with evaluations access can delete training evaluations"
ON public.training_evaluations FOR DELETE
USING (public.has_module_access(auth.uid(), 'evaluations') OR public.has_module_access(auth.uid(), 'formations'));
