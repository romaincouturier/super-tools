
-- crm_scheduled_emails: replace auth.uid() IS NOT NULL with has_crm_access
DROP POLICY IF EXISTS "Authenticated users can delete scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can update scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can view scheduled emails" ON public.crm_scheduled_emails;
CREATE POLICY "crm_staff_select" ON public.crm_scheduled_emails FOR SELECT TO authenticated USING (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_staff_insert" ON public.crm_scheduled_emails FOR INSERT TO authenticated WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_staff_update" ON public.crm_scheduled_emails FOR UPDATE TO authenticated USING (public.has_crm_access(auth.uid())) WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_staff_delete" ON public.crm_scheduled_emails FOR DELETE TO authenticated USING (public.has_crm_access(auth.uid()));

-- scheduled_emails
DROP POLICY IF EXISTS "Authenticated users can manage scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can view scheduled emails" ON public.scheduled_emails;
CREATE POLICY "staff_manage_scheduled_emails" ON public.scheduled_emails FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- email_templates: drop the SELECT true permissive
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
CREATE POLICY "staff_view_email_templates" ON public.email_templates FOR SELECT TO authenticated USING (public.is_staff_user());

-- events
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can read events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON public.events;
CREATE POLICY "staff_select_events" ON public.events FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_events" ON public.events FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_events" ON public.events FOR DELETE TO authenticated USING (public.is_staff_user());

-- mission_activities
DROP POLICY IF EXISTS "Authenticated users can delete mission activities" ON public.mission_activities;
DROP POLICY IF EXISTS "Authenticated users can insert mission activities" ON public.mission_activities;
DROP POLICY IF EXISTS "Authenticated users can update mission activities" ON public.mission_activities;
DROP POLICY IF EXISTS "Authenticated users can view mission activities" ON public.mission_activities;
CREATE POLICY "staff_select_mission_activities" ON public.mission_activities FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_mission_activities" ON public.mission_activities FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_mission_activities" ON public.mission_activities FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_mission_activities" ON public.mission_activities FOR DELETE TO authenticated USING (public.is_staff_user());

-- mission_credits
DROP POLICY IF EXISTS "Authenticated users can delete mission credits" ON public.mission_credits;
DROP POLICY IF EXISTS "Authenticated users can insert mission credits" ON public.mission_credits;
DROP POLICY IF EXISTS "Authenticated users can update mission credits" ON public.mission_credits;
DROP POLICY IF EXISTS "Authenticated users can view mission credits" ON public.mission_credits;
CREATE POLICY "staff_select_mission_credits" ON public.mission_credits FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_mission_credits" ON public.mission_credits FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_mission_credits" ON public.mission_credits FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_mission_credits" ON public.mission_credits FOR DELETE TO authenticated USING (public.is_staff_user());

-- mission_pages
DROP POLICY IF EXISTS "Authenticated users can delete mission pages" ON public.mission_pages;
DROP POLICY IF EXISTS "Authenticated users can insert mission pages" ON public.mission_pages;
DROP POLICY IF EXISTS "Authenticated users can update mission pages" ON public.mission_pages;
DROP POLICY IF EXISTS "Authenticated users can view mission pages" ON public.mission_pages;
CREATE POLICY "staff_select_mission_pages" ON public.mission_pages FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_mission_pages" ON public.mission_pages FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_mission_pages" ON public.mission_pages FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_mission_pages" ON public.mission_pages FOR DELETE TO authenticated USING (public.is_staff_user());

-- mission_documents (no staff restrictive today; add staff permissive)
DROP POLICY IF EXISTS "mission_documents_delete" ON public.mission_documents;
DROP POLICY IF EXISTS "mission_documents_insert" ON public.mission_documents;
DROP POLICY IF EXISTS "mission_documents_select" ON public.mission_documents;
DROP POLICY IF EXISTS "mission_documents_update" ON public.mission_documents;
CREATE POLICY "staff_select_mission_documents" ON public.mission_documents FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_mission_documents" ON public.mission_documents FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_mission_documents" ON public.mission_documents FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_mission_documents" ON public.mission_documents FOR DELETE TO authenticated USING (public.is_staff_user());

-- mission_page_templates
DROP POLICY IF EXISTS "Authenticated users can manage page templates" ON public.mission_page_templates;
CREATE POLICY "staff_manage_mission_page_templates" ON public.mission_page_templates FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- training_documents
DROP POLICY IF EXISTS "training_documents_delete" ON public.training_documents;
DROP POLICY IF EXISTS "training_documents_insert" ON public.training_documents;
DROP POLICY IF EXISTS "training_documents_select" ON public.training_documents;
DROP POLICY IF EXISTS "training_documents_update" ON public.training_documents;
CREATE POLICY "staff_select_training_documents" ON public.training_documents FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_training_documents" ON public.training_documents FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_training_documents" ON public.training_documents FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_training_documents" ON public.training_documents FOR DELETE TO authenticated USING (public.is_staff_user());

-- training_media
DROP POLICY IF EXISTS "Authenticated users can delete training media" ON public.training_media;
DROP POLICY IF EXISTS "Authenticated users can insert training media" ON public.training_media;
DROP POLICY IF EXISTS "Authenticated users can update training media" ON public.training_media;
DROP POLICY IF EXISTS "Authenticated users can view training media" ON public.training_media;
CREATE POLICY "staff_select_training_media" ON public.training_media FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_training_media" ON public.training_media FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_training_media" ON public.training_media FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_training_media" ON public.training_media FOR DELETE TO authenticated USING (public.is_staff_user());

-- participant_files
DROP POLICY IF EXISTS "participant_files_delete" ON public.participant_files;
DROP POLICY IF EXISTS "participant_files_insert" ON public.participant_files;
DROP POLICY IF EXISTS "participant_files_select" ON public.participant_files;
DROP POLICY IF EXISTS "participant_files_update" ON public.participant_files;
CREATE POLICY "staff_select_participant_files" ON public.participant_files FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_participant_files" ON public.participant_files FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_participant_files" ON public.participant_files FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_participant_files" ON public.participant_files FOR DELETE TO authenticated USING (public.is_staff_user());

-- trainer_documents
DROP POLICY IF EXISTS "Authenticated users can manage trainer documents" ON public.trainer_documents;
CREATE POLICY "staff_manage_trainer_documents" ON public.trainer_documents FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- training_coaching_slots
DROP POLICY IF EXISTS "Authenticated users can manage coaching slots" ON public.training_coaching_slots;
DROP POLICY IF EXISTS "Authenticated users can view coaching slots" ON public.training_coaching_slots;
CREATE POLICY "staff_select_training_coaching_slots" ON public.training_coaching_slots FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_training_coaching_slots" ON public.training_coaching_slots FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_training_coaching_slots" ON public.training_coaching_slots FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_training_coaching_slots" ON public.training_coaching_slots FOR DELETE TO authenticated USING (public.is_staff_user());

-- training_live_meetings
DROP POLICY IF EXISTS "Authenticated users can manage live meetings" ON public.training_live_meetings;
DROP POLICY IF EXISTS "Authenticated users can view live meetings" ON public.training_live_meetings;
CREATE POLICY "staff_select_training_live_meetings" ON public.training_live_meetings FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_training_live_meetings" ON public.training_live_meetings FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_training_live_meetings" ON public.training_live_meetings FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_training_live_meetings" ON public.training_live_meetings FOR DELETE TO authenticated USING (public.is_staff_user());

-- session_start_notifications
DROP POLICY IF EXISTS "Authenticated users can manage session notifications" ON public.session_start_notifications;
CREATE POLICY "staff_manage_session_start_notifications" ON public.session_start_notifications FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- program_files: SELECT true → is_staff_user; keep uploader-scoped insert/delete
DROP POLICY IF EXISTS "Authenticated users can view program files" ON public.program_files;
CREATE POLICY "staff_view_program_files" ON public.program_files FOR SELECT TO authenticated USING (public.is_staff_user());

-- quotes
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
CREATE POLICY "staff_select_quotes" ON public.quotes FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "staff_insert_quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_update_quotes" ON public.quotes FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "staff_delete_quotes" ON public.quotes FOR DELETE TO authenticated USING (public.is_staff_user());

-- newsletters
DROP POLICY IF EXISTS "Authenticated users can create newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Authenticated users can delete newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Authenticated users can manage newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Authenticated users can update newsletters" ON public.newsletters;
DROP POLICY IF EXISTS "Authenticated users can view newsletters" ON public.newsletters;
CREATE POLICY "staff_manage_newsletters" ON public.newsletters FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- newsletter_cards
DROP POLICY IF EXISTS "Authenticated users can create newsletter_cards" ON public.newsletter_cards;
DROP POLICY IF EXISTS "Authenticated users can delete newsletter_cards" ON public.newsletter_cards;
DROP POLICY IF EXISTS "Authenticated users can manage newsletter_cards" ON public.newsletter_cards;
DROP POLICY IF EXISTS "Authenticated users can update newsletter_cards" ON public.newsletter_cards;
DROP POLICY IF EXISTS "Authenticated users can view newsletter_cards" ON public.newsletter_cards;
CREATE POLICY "staff_manage_newsletter_cards" ON public.newsletter_cards FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- watch_items
DROP POLICY IF EXISTS "watch_items_delete" ON public.watch_items;
DROP POLICY IF EXISTS "watch_items_insert" ON public.watch_items;
DROP POLICY IF EXISTS "watch_items_select" ON public.watch_items;
DROP POLICY IF EXISTS "watch_items_update" ON public.watch_items;
CREATE POLICY "staff_manage_watch_items" ON public.watch_items FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- watch_digests
DROP POLICY IF EXISTS "watch_digests_insert" ON public.watch_digests;
DROP POLICY IF EXISTS "watch_digests_select" ON public.watch_digests;
CREATE POLICY "staff_manage_watch_digests" ON public.watch_digests FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- watch_clusters
DROP POLICY IF EXISTS "watch_clusters_delete" ON public.watch_clusters;
DROP POLICY IF EXISTS "watch_clusters_insert" ON public.watch_clusters;
DROP POLICY IF EXISTS "watch_clusters_select" ON public.watch_clusters;
DROP POLICY IF EXISTS "watch_clusters_update" ON public.watch_clusters;
CREATE POLICY "staff_manage_watch_clusters" ON public.watch_clusters FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- OKR tables
DROP POLICY IF EXISTS "Authenticated users can delete OKR check-ins" ON public.okr_check_ins;
DROP POLICY IF EXISTS "Authenticated users can insert OKR check-ins" ON public.okr_check_ins;
DROP POLICY IF EXISTS "Authenticated users can update OKR check-ins" ON public.okr_check_ins;
DROP POLICY IF EXISTS "Authenticated users can view OKR check-ins" ON public.okr_check_ins;
CREATE POLICY "staff_manage_okr_check_ins" ON public.okr_check_ins FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can delete OKR initiatives" ON public.okr_initiatives;
DROP POLICY IF EXISTS "Authenticated users can insert OKR initiatives" ON public.okr_initiatives;
DROP POLICY IF EXISTS "Authenticated users can update OKR initiatives" ON public.okr_initiatives;
DROP POLICY IF EXISTS "Authenticated users can view OKR initiatives" ON public.okr_initiatives;
CREATE POLICY "staff_manage_okr_initiatives" ON public.okr_initiatives FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can delete OKR key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can insert OKR key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can update OKR key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can view OKR key results" ON public.okr_key_results;
CREATE POLICY "staff_manage_okr_key_results" ON public.okr_key_results FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can delete OKR objectives" ON public.okr_objectives;
DROP POLICY IF EXISTS "Authenticated users can insert OKR objectives" ON public.okr_objectives;
DROP POLICY IF EXISTS "Authenticated users can update OKR objectives" ON public.okr_objectives;
DROP POLICY IF EXISTS "Authenticated users can view OKR objectives" ON public.okr_objectives;
CREATE POLICY "staff_manage_okr_objectives" ON public.okr_objectives FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can delete OKR participants" ON public.okr_participants;
DROP POLICY IF EXISTS "Authenticated users can insert OKR participants" ON public.okr_participants;
DROP POLICY IF EXISTS "Authenticated users can update OKR participants" ON public.okr_participants;
DROP POLICY IF EXISTS "Authenticated users can view OKR participants" ON public.okr_participants;
CREATE POLICY "staff_manage_okr_participants" ON public.okr_participants FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- missions: drop redundant permissive that duplicates staff_only_* restrictive; keep is_staff_user permissive
-- (missions_select/insert/update/delete permissive already use is_staff_user — leave them)
