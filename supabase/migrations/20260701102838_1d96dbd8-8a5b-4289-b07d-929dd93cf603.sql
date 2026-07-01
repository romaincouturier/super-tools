
-- Helper macro-like: is_admin(auth.uid()) OR has_module_access(auth.uid(), '<module>')

-- ============ activity_logs ============
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON public.activity_logs;
CREATE POLICY "Staff can view activity logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_staff_user());

-- ============ bpf_reports (financial) ============
DROP POLICY IF EXISTS "Authenticated users can manage bpf_reports" ON public.bpf_reports;
CREATE POLICY "Finance staff can manage bpf_reports" ON public.bpf_reports
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'finances'));

-- ============ sponsor_cold_evaluations ============
DROP POLICY IF EXISTS "Authenticated users can read sponsor cold evaluations" ON public.sponsor_cold_evaluations;
DROP POLICY IF EXISTS "Authenticated users can update sponsor cold evaluations" ON public.sponsor_cold_evaluations;
DROP POLICY IF EXISTS "Authenticated users can insert sponsor cold evaluations" ON public.sponsor_cold_evaluations;
CREATE POLICY "Formations staff read sponsor cold evaluations" ON public.sponsor_cold_evaluations
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));
CREATE POLICY "Formations staff write sponsor cold evaluations" ON public.sponsor_cold_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));
CREATE POLICY "Formations staff update sponsor cold evaluations" ON public.sponsor_cold_evaluations
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));

-- ============ stakeholder_appreciations ============
DROP POLICY IF EXISTS "Authenticated users can manage stakeholder appreciations" ON public.stakeholder_appreciations;
CREATE POLICY "Formations staff manage stakeholder appreciations" ON public.stakeholder_appreciations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));

-- ============ trainer_evaluations ============
DROP POLICY IF EXISTS "Authenticated users can manage trainer evaluations" ON public.trainer_evaluations;
CREATE POLICY "Formations staff manage trainer evaluations" ON public.trainer_evaluations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));

-- ============ event_shares ============
DROP POLICY IF EXISTS "Authenticated users can read event_shares" ON public.event_shares;
DROP POLICY IF EXISTS "Authenticated users can delete event_shares" ON public.event_shares;
DROP POLICY IF EXISTS "Authenticated users can insert event_shares" ON public.event_shares;
CREATE POLICY "Staff read event_shares" ON public.event_shares
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_staff_user());

-- ============ game_sales / game_authors (dropshipping) ============
DROP POLICY IF EXISTS "Authenticated can manage game_sales" ON public.game_sales;
CREATE POLICY "Staff manage game_sales" ON public.game_sales
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

DROP POLICY IF EXISTS "Authenticated can manage game_authors" ON public.game_authors;
CREATE POLICY "Staff manage game_authors" ON public.game_authors
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

-- ============ group_matching_members / registrations ============
DROP POLICY IF EXISTS "Authenticated users can manage group matching members" ON public.group_matching_members;
CREATE POLICY "Staff manage group_matching_members" ON public.group_matching_members
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

DROP POLICY IF EXISTS "Authenticated users can manage group matching registrations" ON public.group_matching_registrations;
CREATE POLICY "Staff manage group_matching_registrations" ON public.group_matching_registrations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ learner_profiles ============
DROP POLICY IF EXISTS "auth_manage_learner_profiles" ON public.learner_profiles;
CREATE POLICY "Staff manage learner_profiles" ON public.learner_profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ mission_contacts ============
DROP POLICY IF EXISTS "Authenticated users can view mission contacts" ON public.mission_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert mission contacts" ON public.mission_contacts;
DROP POLICY IF EXISTS "Authenticated users can update mission contacts" ON public.mission_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete mission contacts" ON public.mission_contacts;
CREATE POLICY "Staff view mission_contacts" ON public.mission_contacts
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'));
CREATE POLICY "Staff insert mission_contacts" ON public.mission_contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'));
CREATE POLICY "Staff update mission_contacts" ON public.mission_contacts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'));
CREATE POLICY "Staff delete mission_contacts" ON public.mission_contacts
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'));

-- ============ order_email_log / order_items ============
DROP POLICY IF EXISTS "Authenticated can manage order_email_log" ON public.order_email_log;
CREATE POLICY "Staff manage order_email_log" ON public.order_email_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

DROP POLICY IF EXISTS "Authenticated can manage order_items" ON public.order_items;
CREATE POLICY "Staff manage order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

-- ============ partner_access_tokens / partner_payments (admin only) ============
DROP POLICY IF EXISTS "Authenticated can manage partner_access_tokens" ON public.partner_access_tokens;
CREATE POLICY "Admin manage partner_access_tokens" ON public.partner_access_tokens
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can manage partner_payments" ON public.partner_payments;
CREATE POLICY "Admin manage partner_payments" ON public.partner_payments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ profiles (leaks is_admin) ============
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- "User can read own profile" remains

-- ============ questionnaire_besoins ============
DROP POLICY IF EXISTS "Authenticated users can view questionnaires" ON public.questionnaire_besoins;
DROP POLICY IF EXISTS "Authenticated users can update questionnaires" ON public.questionnaire_besoins;
CREATE POLICY "Formations staff view questionnaires" ON public.questionnaire_besoins
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Formations staff update questionnaires" ON public.questionnaire_besoins
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ reclamations ============
DROP POLICY IF EXISTS "Authenticated users can view reclamations" ON public.reclamations;
DROP POLICY IF EXISTS "Authenticated users can update reclamations" ON public.reclamations;
DROP POLICY IF EXISTS "Authenticated users can delete reclamations" ON public.reclamations;
CREATE POLICY "Staff view reclamations" ON public.reclamations
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff update reclamations" ON public.reclamations
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff delete reclamations" ON public.reclamations
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ sent_emails_log / failed_emails ============
DROP POLICY IF EXISTS "Authenticated users can read sent emails" ON public.sent_emails_log;
CREATE POLICY "Admin read sent emails" ON public.sent_emails_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view failed emails" ON public.failed_emails;
DROP POLICY IF EXISTS "Authenticated users can update failed emails" ON public.failed_emails;
DROP POLICY IF EXISTS "Authenticated users can delete failed emails" ON public.failed_emails;
CREATE POLICY "Admin view failed emails" ON public.failed_emails
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update failed emails" ON public.failed_emails
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete failed emails" ON public.failed_emails
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============ signature records ============
DROP POLICY IF EXISTS "Authenticated users can manage convention signatures" ON public.convention_signatures;
CREATE POLICY "Staff manage convention_signatures" ON public.convention_signatures
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

DROP POLICY IF EXISTS "Authenticated users can view devis signatures" ON public.devis_signatures;
DROP POLICY IF EXISTS "Authenticated users can update devis signatures" ON public.devis_signatures;
DROP POLICY IF EXISTS "Authenticated users can delete devis signatures" ON public.devis_signatures;
CREATE POLICY "Staff view devis_signatures" ON public.devis_signatures
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_crm_access(auth.uid()));
CREATE POLICY "Staff update devis_signatures" ON public.devis_signatures
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_crm_access(auth.uid()));
CREATE POLICY "Staff delete devis_signatures" ON public.devis_signatures
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view signatures" ON public.attendance_signatures;
DROP POLICY IF EXISTS "Authenticated users can update signatures" ON public.attendance_signatures;
DROP POLICY IF EXISTS "Authenticated users can delete signatures" ON public.attendance_signatures;
CREATE POLICY "Staff view attendance_signatures" ON public.attendance_signatures
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff update attendance_signatures" ON public.attendance_signatures
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff delete attendance_signatures" ON public.attendance_signatures
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ training_actions ============
DROP POLICY IF EXISTS "Authenticated users can view training actions" ON public.training_actions;
DROP POLICY IF EXISTS "Authenticated users can update training actions" ON public.training_actions;
DROP POLICY IF EXISTS "Authenticated users can delete training actions" ON public.training_actions;
CREATE POLICY "Formations staff view training_actions" ON public.training_actions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Formations staff update training_actions" ON public.training_actions
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Formations staff delete training_actions" ON public.training_actions
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- ============ woocommerce_orders / pending_formations ============
DROP POLICY IF EXISTS "Authenticated can manage woocommerce_orders" ON public.woocommerce_orders;
CREATE POLICY "Admin manage woocommerce_orders" ON public.woocommerce_orders
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users manage pending formations" ON public.woocommerce_pending_formations;
CREATE POLICY "Admin manage woocommerce_pending_formations" ON public.woocommerce_pending_formations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ function search_path fixes ============
ALTER FUNCTION public.agent_sql_query(text) SET search_path = public;
ALTER FUNCTION public.enqueue_indexation() SET search_path = public;
ALTER FUNCTION public.recompute_opportunity_estimated_value(uuid) SET search_path = public;
