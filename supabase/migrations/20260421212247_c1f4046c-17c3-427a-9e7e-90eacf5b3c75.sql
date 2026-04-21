
DROP POLICY IF EXISTS "Admin can view all module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can insert module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can update module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can delete module access" ON public.user_module_access;

CREATE POLICY "Admin can view all module access" ON public.user_module_access FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can insert module access" ON public.user_module_access FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update module access" ON public.user_module_access FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can delete module access" ON public.user_module_access FOR DELETE TO authenticated USING (is_admin(auth.uid()));
