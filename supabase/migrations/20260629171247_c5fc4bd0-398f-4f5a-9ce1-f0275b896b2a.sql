
-- checklist_templates
DROP POLICY IF EXISTS "ct_insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_update" ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_delete" ON public.checklist_templates;

CREATE POLICY "ct_insert" ON public.checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND public.is_admin(auth.uid()))
  );

CREATE POLICY "ct_update" ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND public.is_admin(auth.uid()))
  )
  WITH CHECK (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND public.is_admin(auth.uid()))
  );

CREATE POLICY "ct_delete" ON public.checklist_templates
  FOR DELETE TO authenticated
  USING (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND public.is_admin(auth.uid()))
  );

-- checklist_template_items
DROP POLICY IF EXISTS "cti_insert" ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_update" ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_delete" ON public.checklist_template_items;

CREATE POLICY "cti_insert" ON public.checklist_template_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND public.is_admin(auth.uid()))
      )
  ));

CREATE POLICY "cti_update" ON public.checklist_template_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND public.is_admin(auth.uid()))
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND public.is_admin(auth.uid()))
      )
  ));

CREATE POLICY "cti_delete" ON public.checklist_template_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND public.is_admin(auth.uid()))
      )
  ));
