ALTER FUNCTION public.normalize_url(text) SET search_path = public;
ALTER FUNCTION public.url_path(text) SET search_path = public;
ALTER FUNCTION public.agent_sql_query(text, uuid, text) SET search_path = public;

DROP POLICY IF EXISTS "Authenticated users can manage revenue targets" ON public.crm_revenue_targets;
CREATE POLICY "crm_revenue_targets_manage" ON public.crm_revenue_targets
  FOR ALL TO authenticated
  USING (public.has_crm_access(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_crm_access(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can manage game_expenses" ON public.game_expenses;
CREATE POLICY "game_expenses_manage" ON public.game_expenses
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'dropshipping') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_module_access(auth.uid(), 'dropshipping') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can manage games" ON public.games;
CREATE POLICY "games_manage" ON public.games
  FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'dropshipping') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_module_access(auth.uid(), 'dropshipping') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "ideas_select" ON public.ideas;
DROP POLICY IF EXISTS "ideas_insert" ON public.ideas;
DROP POLICY IF EXISTS "ideas_update" ON public.ideas;
DROP POLICY IF EXISTS "ideas_delete" ON public.ideas;
CREATE POLICY "ideas_staff_all" ON public.ideas
  FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "mission_email_drafts_select" ON public.mission_email_drafts;
DROP POLICY IF EXISTS "mission_email_drafts_insert" ON public.mission_email_drafts;
DROP POLICY IF EXISTS "mission_email_drafts_update" ON public.mission_email_drafts;
DROP POLICY IF EXISTS "mission_email_drafts_delete" ON public.mission_email_drafts;
CREATE POLICY "mission_email_drafts_staff_all" ON public.mission_email_drafts
  FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "auth_manage_game_restocks" ON public.game_restocks;
CREATE POLICY "game_restocks_staff_all" ON public.game_restocks
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
DROP POLICY IF EXISTS "auth_manage_game_restock_items" ON public.game_restock_items;
CREATE POLICY "game_restock_items_staff_all" ON public.game_restock_items
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
DROP POLICY IF EXISTS "auth_manage_game_restock_actions" ON public.game_restock_actions;
CREATE POLICY "game_restock_actions_staff_all" ON public.game_restock_actions
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
DROP POLICY IF EXISTS "auth_manage_game_restock_action_files" ON public.game_restock_action_files;
CREATE POLICY "game_restock_action_files_staff_all" ON public.game_restock_action_files
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "authenticated_insert_commercial_coach_contexts" ON public.commercial_coach_contexts;
DROP POLICY IF EXISTS "authenticated_update_commercial_coach_contexts" ON public.commercial_coach_contexts;
DROP POLICY IF EXISTS "authenticated_delete_commercial_coach_contexts" ON public.commercial_coach_contexts;
CREATE POLICY "commercial_coach_contexts_staff_write" ON public.commercial_coach_contexts
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());