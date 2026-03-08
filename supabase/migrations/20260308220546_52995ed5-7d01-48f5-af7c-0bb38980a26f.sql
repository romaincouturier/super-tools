
-- Gated RLS policies: only enforce org isolation when multi_tenant_enabled = true
-- When flag is off, all authenticated users see everything (current behavior preserved)

CREATE POLICY "trainings_org_isolation" ON public.trainings
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "crm_cards_org_isolation" ON public.crm_cards
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "missions_org_isolation" ON public.missions
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "events_org_isolation" ON public.events
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "improvements_org_isolation" ON public.improvements
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "formation_configs_org_isolation" ON public.formation_configs
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "content_cards_org_isolation" ON public.content_cards
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );

CREATE POLICY "media_org_isolation" ON public.media
  FOR ALL TO authenticated
  USING (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    NOT public.is_feature_enabled('multi_tenant_enabled')
    OR org_id = public.get_user_org_id(auth.uid())
  );
