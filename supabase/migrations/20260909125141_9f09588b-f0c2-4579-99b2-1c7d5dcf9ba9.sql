-- 20260908100000_quality_risks_module.sql
DROP POLICY IF EXISTS quality_risks_manage ON public.quality_risks;
CREATE POLICY quality_risks_manage ON public.quality_risks
  FOR ALL TO authenticated
  USING (
    has_module_access(auth.uid(), 'risques')
    OR has_module_access(auth.uid(), 'formations')
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    has_module_access(auth.uid(), 'risques')
    OR has_module_access(auth.uid(), 'formations')
    OR is_admin(auth.uid())
  );