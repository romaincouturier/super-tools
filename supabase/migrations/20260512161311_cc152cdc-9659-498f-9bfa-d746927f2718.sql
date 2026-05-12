
DROP POLICY IF EXISTS "Users can view their own supertilt actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Users can create their own supertilt actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Users can update their own supertilt actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Users can delete their own supertilt actions" ON public.supertilt_actions;

CREATE POLICY "Supertilt members can view actions"
ON public.supertilt_actions FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));

CREATE POLICY "Supertilt members can insert actions"
ON public.supertilt_actions FOR INSERT TO authenticated
WITH CHECK ((public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt')) AND user_id = auth.uid());

CREATE POLICY "Supertilt members can update actions"
ON public.supertilt_actions FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));

CREATE POLICY "Supertilt members can delete actions"
ON public.supertilt_actions FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));

DROP POLICY IF EXISTS "Users view own supertilt columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Users create own supertilt columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Users update own supertilt columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Users delete own supertilt columns" ON public.supertilt_columns;

CREATE POLICY "Supertilt members can view columns"
ON public.supertilt_columns FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));

CREATE POLICY "Supertilt members can insert columns"
ON public.supertilt_columns FOR INSERT TO authenticated
WITH CHECK ((public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt')) AND user_id = auth.uid());

CREATE POLICY "Supertilt members can update columns"
ON public.supertilt_columns FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));

CREATE POLICY "Supertilt members can delete columns"
ON public.supertilt_columns FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt'));
