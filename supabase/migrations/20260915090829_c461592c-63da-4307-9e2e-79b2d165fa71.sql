-- 1. Trigger functions: never called directly through the API
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 2. Internal / service-role only functions
DO $$
DECLARE f text;
  sigs text[] := ARRAY[
    'public.adjust_cron_timezones()',
    'public.agent_sql_query(text)',
    'public.agent_sql_query(text, uuid, text)',
    'public.decrypt_token(bytea, text)',
    'public.encrypt_token(text, text)',
    'public.monitor_cron_failures()',
    'public.monitor_missing_evaluation_reminders()',
    'public.move_stale_tickets_to_boite_a_idees()',
    'public.purge_seo_history()',
    'public.reap_stuck_ticket_coding()',
    'public.update_api_key_last_used(uuid)',
    'public.register_formulaire_orphan(text, text, text, integer, text)',
    'public.resolve_formulaire_token(text, integer, text)',
    'public.next_location_contract_ref(integer)',
    'public.sync_training_schedules_from_lives(uuid)'
  ];
BEGIN
  FOREACH f IN ARRAY sigs LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid::regprocedure::text = f::regprocedure::text) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END IF;
  END LOOP;
END $$;

-- 3. Staff-only functions: keep signed-in access, drop anonymous access
DO $$
DECLARE f text;
  sigs text[] := ARRAY[
    'public.get_api_usage_daily(integer)',
    'public.get_api_usage_top_calls(integer, integer)',
    'public.get_api_usage_by_task(integer, integer)',
    'public.get_cron_status()',
    'public.get_db_size()',
    'public.get_nav_usage_counts()',
    'public.get_staff_directory()',
    'public.get_staff_public_profiles()',
    'public.get_course_training_sessions_admin(uuid)',
    'public.get_previous_trainer_evaluations(text, uuid)',
    'public.get_vhd_narrative_access(uuid)',
    'public.read_vhd_narrative(uuid)',
    'public.practice_popular_hashtags(integer)',
    'public.recompute_opportunity_estimated_value(uuid)',
    'public.has_crm_access(uuid)',
    'public.has_module_access(uuid, text)',
    'public.is_admin(uuid)',
    'public.is_staff_user()',
    'public.is_feature_enabled(text)',
    'public.get_user_org_id(uuid)',
    'public.upsert_profile(uuid, text, text)',
    'public.lms_learner_is_enrolled(uuid)'
  ];
BEGIN
  FOREACH f IN ARRAY sigs LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid::regprocedure::text = f::regprocedure::text) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    END IF;
  END LOOP;
END $$;

-- 4. Tables with RLS enabled but no policy: make the intent explicit (staff read only)
DROP POLICY IF EXISTS "staff_read_formulaire_rate_limits" ON public.formulaire_rate_limits;
CREATE POLICY "staff_read_formulaire_rate_limits" ON public.formulaire_rate_limits
  FOR SELECT TO authenticated USING (public.is_staff_user());

DROP POLICY IF EXISTS "staff_read_learner_magic_links" ON public.learner_magic_links;
CREATE POLICY "staff_read_learner_magic_links" ON public.learner_magic_links
  FOR SELECT TO authenticated USING (public.is_staff_user());

DROP POLICY IF EXISTS "staff_read_mcp_oauth_records" ON public.mcp_oauth_records;
CREATE POLICY "staff_read_mcp_oauth_records" ON public.mcp_oauth_records
  FOR SELECT TO authenticated USING (public.is_staff_user());