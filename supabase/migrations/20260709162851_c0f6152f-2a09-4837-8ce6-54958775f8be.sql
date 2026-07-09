
-- ============ CRM tables: replace true SELECT with has_crm_access ============
DROP POLICY IF EXISTS "crm_cards_select" ON public.crm_cards;
CREATE POLICY "crm_cards_select" ON public.crm_cards FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_columns_select" ON public.crm_columns;
CREATE POLICY "crm_columns_select" ON public.crm_columns FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_activity_log_select" ON public.crm_activity_log;
CREATE POLICY "crm_activity_log_select" ON public.crm_activity_log FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_card_emails_select" ON public.crm_card_emails;
CREATE POLICY "crm_card_emails_select" ON public.crm_card_emails FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_comments_select" ON public.crm_comments;
CREATE POLICY "crm_comments_select" ON public.crm_comments FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_tags_select" ON public.crm_tags;
CREATE POLICY "crm_tags_select" ON public.crm_tags FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_attachments_select" ON public.crm_attachments;
CREATE POLICY "crm_attachments_select" ON public.crm_attachments FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "crm_card_tags_select" ON public.crm_card_tags;
CREATE POLICY "crm_card_tags_select" ON public.crm_card_tags FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));

-- ============ evaluation_analyses: replace true policies with staff check ============
DROP POLICY IF EXISTS "Authenticated users can view analyses" ON public.evaluation_analyses;
DROP POLICY IF EXISTS "Authenticated users can create analyses" ON public.evaluation_analyses;
DROP POLICY IF EXISTS "Authenticated users can delete analyses" ON public.evaluation_analyses;
CREATE POLICY "evaluation_analyses_select" ON public.evaluation_analyses FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "evaluation_analyses_insert" ON public.evaluation_analyses FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "evaluation_analyses_delete" ON public.evaluation_analyses FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ improvements: remove true policies (staff_only_* remain) ============
DROP POLICY IF EXISTS "Authenticated users can view improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can create improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can insert improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can update improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can delete improvements" ON public.improvements;
CREATE POLICY "improvements_select" ON public.improvements FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "improvements_insert" ON public.improvements FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "improvements_update" ON public.improvements FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "improvements_delete" ON public.improvements FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ media: remove true policies ============
DROP POLICY IF EXISTS "Anyone can view media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can delete media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can update media" ON public.media;
CREATE POLICY "media_select" ON public.media FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "media_insert" ON public.media FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "media_update" ON public.media FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "media_delete" ON public.media FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ missions: remove true policies (staff_only_* remain) ============
DROP POLICY IF EXISTS "Authenticated users can view missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can delete missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can insert missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can update missions" ON public.missions;
CREATE POLICY "missions_select" ON public.missions FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "missions_insert" ON public.missions FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "missions_update" ON public.missions FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "missions_delete" ON public.missions FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ quote_settings: remove true policies ============
DROP POLICY IF EXISTS "Authenticated users can read quote_settings" ON public.quote_settings;
DROP POLICY IF EXISTS "Authenticated users can update quote_settings" ON public.quote_settings;
CREATE POLICY "quote_settings_select" ON public.quote_settings FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "quote_settings_update" ON public.quote_settings FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- ============ support_tickets: restrict to staff ============
DROP POLICY IF EXISTS "support_tickets_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update" ON public.support_tickets;
CREATE POLICY "support_tickets_select" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "support_tickets_update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- ============ time_entries: restrict to staff (table has no user_id column) ============
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON public.time_entries;
CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "time_entries_update" ON public.time_entries FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "time_entries_delete" ON public.time_entries FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ trainings: remove true policies (staff_only_* remain) ============
DROP POLICY IF EXISTS "Authenticated users can view trainings" ON public.trainings;
DROP POLICY IF EXISTS "Authenticated users can delete trainings" ON public.trainings;
DROP POLICY IF EXISTS "Authenticated users can update trainings" ON public.trainings;
CREATE POLICY "trainings_select" ON public.trainings FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "trainings_update" ON public.trainings FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "trainings_delete" ON public.trainings FOR DELETE TO authenticated USING (public.is_staff_user());

-- ============ lms_lesson_blocks: restrict manage-all-true to staff ============
DROP POLICY IF EXISTS "auth_manage_lesson_blocks" ON public.lms_lesson_blocks;
CREATE POLICY "staff_manage_lesson_blocks" ON public.lms_lesson_blocks
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- ============ Fix search_path on 20 remaining public functions ============
ALTER FUNCTION public._set_checklist_template_updated_at() SET search_path = public;
ALTER FUNCTION public.cleanup_agent_embedding_cache() SET search_path = public;
ALTER FUNCTION public.decay_watch_relevance() SET search_path = public;
ALTER FUNCTION public.get_agent_allowed_tables() SET search_path = public;
ALTER FUNCTION public.get_agent_schema_prompt() SET search_path = public;
ALTER FUNCTION public.increment_agent_tokens(uuid, integer, integer, jsonb) SET search_path = public;
ALTER FUNCTION public.lms_lesson_blocks_check_parent_lesson() SET search_path = public;
ALTER FUNCTION public.match_documents(text, double precision, integer, text[]) SET search_path = public, extensions;
ALTER FUNCTION public.match_editorial_recommendations(extensions.vector, integer) SET search_path = public, extensions;
ALTER FUNCTION public.match_editorial_themes(extensions.vector, integer) SET search_path = public, extensions;
ALTER FUNCTION public.match_ideas(extensions.vector, integer, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.match_watch_items(text, double precision, integer) SET search_path = public, extensions;
ALTER FUNCTION public.match_wp_articles(extensions.vector, integer) SET search_path = public, extensions;
ALTER FUNCTION public.quotes_recompute_on_sent() SET search_path = public;
ALTER FUNCTION public.set_ideas_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_lms_lesson_blocks_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_lms_work_deposit_tables() SET search_path = public;
ALTER FUNCTION public.touch_lms_work_deposit_visibility() SET search_path = public;
ALTER FUNCTION public.update_pictodico_challenges_updated_at() SET search_path = public;
ALTER FUNCTION public.update_time_entries_updated_at() SET search_path = public;
