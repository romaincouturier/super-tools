-- Remplace toute lecture de auth.users dans les policies par les fonctions
-- SECURITY DEFINER existantes (public.is_admin / public.has_module_access).
-- Périmètre strictement identique : is_admin(auth.uid()) == profiles.is_admin,
-- vérifié en base comme équivalent à l'unique compte romain@supertilt.fr.

-- api_keys
DROP POLICY IF EXISTS "API keys manageable by admins" ON public.api_keys;
CREATE POLICY "API keys manageable by admins" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- api_request_logs
DROP POLICY IF EXISTS "API logs viewable by admins" ON public.api_request_logs;
CREATE POLICY "API logs viewable by admins" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- chatbot_knowledge_base
DROP POLICY IF EXISTS "Knowledge base manageable by admins" ON public.chatbot_knowledge_base;
CREATE POLICY "Knowledge base manageable by admins" ON public.chatbot_knowledge_base
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- balance_sheets
DROP POLICY IF EXISTS "balance_sheets_table_select" ON public.balance_sheets;
CREATE POLICY "balance_sheets_table_select" ON public.balance_sheets
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "balance_sheets_table_insert" ON public.balance_sheets;
CREATE POLICY "balance_sheets_table_insert" ON public.balance_sheets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "balance_sheets_table_update" ON public.balance_sheets;
CREATE POLICY "balance_sheets_table_update" ON public.balance_sheets
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "balance_sheets_table_delete" ON public.balance_sheets;
CREATE POLICY "balance_sheets_table_delete" ON public.balance_sheets
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

-- breakeven_scenarios
DROP POLICY IF EXISTS "breakeven_scenarios_select" ON public.breakeven_scenarios;
CREATE POLICY "breakeven_scenarios_select" ON public.breakeven_scenarios
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "breakeven_scenarios_insert" ON public.breakeven_scenarios;
CREATE POLICY "breakeven_scenarios_insert" ON public.breakeven_scenarios
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "breakeven_scenarios_update" ON public.breakeven_scenarios;
CREATE POLICY "breakeven_scenarios_update" ON public.breakeven_scenarios
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "breakeven_scenarios_delete" ON public.breakeven_scenarios;
CREATE POLICY "breakeven_scenarios_delete" ON public.breakeven_scenarios
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

-- cashflow_forecast
DROP POLICY IF EXISTS "cashflow_forecast_select" ON public.cashflow_forecast;
CREATE POLICY "cashflow_forecast_select" ON public.cashflow_forecast
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "cashflow_forecast_insert" ON public.cashflow_forecast;
CREATE POLICY "cashflow_forecast_insert" ON public.cashflow_forecast
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "cashflow_forecast_update" ON public.cashflow_forecast;
CREATE POLICY "cashflow_forecast_update" ON public.cashflow_forecast
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "cashflow_forecast_delete" ON public.cashflow_forecast;
CREATE POLICY "cashflow_forecast_delete" ON public.cashflow_forecast
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

-- monthly_reports
DROP POLICY IF EXISTS "monthly_reports_select" ON public.monthly_reports;
CREATE POLICY "monthly_reports_select" ON public.monthly_reports
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "monthly_reports_insert" ON public.monthly_reports;
CREATE POLICY "monthly_reports_insert" ON public.monthly_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "monthly_reports_update" ON public.monthly_reports;
CREATE POLICY "monthly_reports_update" ON public.monthly_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));

DROP POLICY IF EXISTS "monthly_reports_delete" ON public.monthly_reports;
CREATE POLICY "monthly_reports_delete" ON public.monthly_reports
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (user_id = auth.uid() AND public.has_module_access(auth.uid(), 'finances')));
