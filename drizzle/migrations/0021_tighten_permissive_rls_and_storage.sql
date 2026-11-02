-- Staff-only reads: drop "USING (true)" SELECT policies where a staff policy already exists
DROP POLICY IF EXISTS "agent_embedding_cache_select_auth" ON public.agent_embedding_cache;
DROP POLICY IF EXISTS "Authenticated users can read event_media" ON public.event_media;
DROP POLICY IF EXISTS "Authenticated users can select formation_formulas" ON public.formation_formulas;
DROP POLICY IF EXISTS "Authenticated users can view formation dates" ON public.formation_dates;
DROP POLICY IF EXISTS "Authenticated users can view training schedules" ON public.training_schedules;
DROP POLICY IF EXISTS "logistics_items_select" ON public.logistics_checklist_items;
DROP POLICY IF EXISTS "pictodico_words_select" ON public.pictodico_words;
DROP POLICY IF EXISTS "tender_documents_select" ON public.tender_documents;
DROP POLICY IF EXISTS "tender_opportunities_select" ON public.tender_opportunities;
DROP POLICY IF EXISTS "import_select" ON public.training_support_imports;
DROP POLICY IF EXISTS "tpl_select" ON public.training_support_templates;
DROP POLICY IF EXISTS "tpl_sec_select" ON public.training_support_template_sections;
DROP POLICY IF EXISTS "authenticated_select_commercial_coach_contexts" ON public.commercial_coach_contexts;
DROP POLICY IF EXISTS "Anyone can log events" ON public.questionnaire_events; -- writes go through insert_questionnaire_event (security definer)

-- Staff-only reads where no staff SELECT existed
DROP POLICY IF EXISTS "Authenticated read wp_traffic_daily" ON public.wp_traffic_daily;
CREATE POLICY "Staff read wp_traffic_daily" ON public.wp_traffic_daily FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated read gsc_metrics_daily" ON public.gsc_metrics_daily;
CREATE POLICY "Staff read gsc_metrics_daily" ON public.gsc_metrics_daily FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated read gsc_sitemaps" ON public.gsc_sitemaps;
CREATE POLICY "Staff read gsc_sitemaps" ON public.gsc_sitemaps FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated read gsc_url_inspections" ON public.gsc_url_inspections;
CREATE POLICY "Staff read gsc_url_inspections" ON public.gsc_url_inspections FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can read health data" ON public.edge_function_health;
CREATE POLICY "Staff read health data" ON public.edge_function_health FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can read db_size_snapshots" ON public.db_size_snapshots;
CREATE POLICY "Staff read db_size_snapshots" ON public.db_size_snapshots FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can view polling cursors" ON public.polling_cursors;
CREATE POLICY "Staff view polling cursors" ON public.polling_cursors FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated read transcript generations" ON public.transcript_generations;
CREATE POLICY "Staff read transcript generations" ON public.transcript_generations FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can read newsletter_comments" ON public.newsletter_comments;
CREATE POLICY "Staff read newsletter_comments" ON public.newsletter_comments FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can view trainers" ON public.trainers;
CREATE POLICY "Staff view trainers" ON public.trainers FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "training_formulas read for authenticated" ON public.training_formulas;
CREATE POLICY "Staff read training_formulas" ON public.training_formulas FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can read post_evaluation_emails" ON public.post_evaluation_emails;
CREATE POLICY "Staff read post_evaluation_emails" ON public.post_evaluation_emails FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "idea_votes_select" ON public.idea_votes;
CREATE POLICY "idea_votes_select" ON public.idea_votes FOR SELECT TO authenticated USING (public.is_staff_user() OR user_id = auth.uid());

-- Catalog visible to learners only for published courses
DROP POLICY IF EXISTS "Authenticated users can view formation configs" ON public.formation_configs;
CREATE POLICY "Staff or published course formation configs" ON public.formation_configs FOR SELECT TO authenticated
USING (public.is_staff_user() OR EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.formation_config_id = formation_configs.id AND c.status = 'published'));

-- Training supports: learners see published only
DROP POLICY IF EXISTS "sup_select" ON public.training_supports;
CREATE POLICY "sup_select" ON public.training_supports FOR SELECT TO authenticated USING (public.is_staff_user() OR is_published = true);
DROP POLICY IF EXISTS "sec_select" ON public.training_support_sections;
CREATE POLICY "sec_select" ON public.training_support_sections FOR SELECT TO authenticated
USING (public.is_staff_user() OR EXISTS (SELECT 1 FROM public.training_supports s WHERE s.id = training_support_sections.support_id AND s.is_published = true));
DROP POLICY IF EXISTS "media_select" ON public.training_support_media;
CREATE POLICY "media_select" ON public.training_support_media FOR SELECT TO authenticated
USING (public.is_staff_user() OR EXISTS (SELECT 1 FROM public.training_supports s WHERE s.id = training_support_media.support_id AND s.is_published = true));

-- Support attachments: staff or ticket submitter
DROP POLICY IF EXISTS "support_attachments_select" ON public.support_ticket_attachments;
CREATE POLICY "support_attachments_select" ON public.support_ticket_attachments FOR SELECT TO authenticated
USING (public.is_staff_user() OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_ticket_attachments.ticket_id AND t.submitted_by = auth.uid()));

-- Reclamations insert: staff only (public form uses token RPC)
DROP POLICY IF EXISTS "Authenticated users can insert reclamations" ON public.reclamations;
CREATE POLICY "Staff insert reclamations" ON public.reclamations FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- Public writes bound to valid parents
DROP POLICY IF EXISTS "public_insert_survey_responses" ON public.mission_survey_responses;
CREATE POLICY "public_insert_survey_responses" ON public.mission_survey_responses FOR INSERT TO anon
WITH CHECK (EXISTS (SELECT 1 FROM public.mission_surveys s WHERE s.id = mission_survey_responses.survey_id AND s.is_active = true));
DROP POLICY IF EXISTS "public_insert_survey_answers" ON public.mission_survey_answers;
CREATE POLICY "public_insert_survey_answers" ON public.mission_survey_answers FOR INSERT TO anon
WITH CHECK (EXISTS (SELECT 1 FROM public.mission_survey_responses r JOIN public.mission_surveys s ON s.id = r.survey_id
  WHERE r.id = mission_survey_answers.response_id AND s.is_active = true AND r.submitted_at > now() - interval '1 hour'));
DROP POLICY IF EXISTS "book_analytics_events_anon_insert" ON public.book_analytics_events;
CREATE POLICY "book_analytics_events_anon_insert" ON public.book_analytics_events FOR INSERT TO anon
WITH CHECK (EXISTS (SELECT 1 FROM public.book_share_links l WHERE l.id = book_analytics_events.link_id AND l.revoked_at IS NULL));

-- Storage: public buckets keep serving public URLs; listing/API reads restricted to staff
DROP POLICY IF EXISTS "Public can view event media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view content images" ON storage.objects;
DROP POLICY IF EXISTS "Training programs are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "lms_content_select_public" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "public_read_learner_photos" ON storage.objects;
DROP POLICY IF EXISTS "review_img_select_v3" ON storage.objects;
DROP POLICY IF EXISTS "training_media_select" ON storage.objects;
DROP POLICY IF EXISTS "ts_storage_public_select" ON storage.objects;
DROP POLICY IF EXISTS "ts_storage_select" ON storage.objects;
CREATE POLICY "staff_select_public_buckets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('event-media','content-images','training-programs','lms-content','media','learner-photos','review-images','training-media','training-supports') AND public.is_staff_user());

-- lms-content writes: staff only (learner uploads go through upload-lms-content)
DROP POLICY IF EXISTS "lms_content_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "lms_content_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "lms_content_delete_authenticated" ON storage.objects;
CREATE POLICY "lms_content_staff_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lms-content' AND public.is_staff_user());
CREATE POLICY "lms_content_staff_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lms-content' AND public.is_staff_user()) WITH CHECK (bucket_id = 'lms-content' AND public.is_staff_user());
CREATE POLICY "lms_content_staff_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lms-content' AND public.is_staff_user());

-- participant-files (private): staff only
DROP POLICY IF EXISTS "participant_files_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "participant_files_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "participant_files_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "participant_files_bucket_delete" ON storage.objects;
CREATE POLICY "participant_files_staff_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'participant-files' AND public.is_staff_user());
CREATE POLICY "participant_files_staff_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'participant-files' AND public.is_staff_user());
CREATE POLICY "participant_files_staff_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'participant-files' AND public.is_staff_user()) WITH CHECK (bucket_id = 'participant-files' AND public.is_staff_user());
CREATE POLICY "participant_files_staff_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'participant-files' AND public.is_staff_user());

-- devis-pdfs (private): uploads by service role only, reads by staff
DROP POLICY IF EXISTS "Service role can upload devis PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read devis PDFs" ON storage.objects;
CREATE POLICY "Staff read devis PDFs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'devis-pdfs' AND public.is_staff_user());