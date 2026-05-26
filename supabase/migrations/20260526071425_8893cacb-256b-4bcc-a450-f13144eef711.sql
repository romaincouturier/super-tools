
-- =========================================================
-- Security fixes batch: lock down overly-permissive RLS
-- =========================================================

-- admin_documents: drop public-all policies, restrict to admins
DROP POLICY IF EXISTS admin_documents_select ON public.admin_documents;
DROP POLICY IF EXISTS admin_documents_insert ON public.admin_documents;
DROP POLICY IF EXISTS admin_documents_update ON public.admin_documents;
DROP POLICY IF EXISTS admin_documents_delete ON public.admin_documents;

CREATE POLICY admin_documents_admin_select ON public.admin_documents
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY admin_documents_admin_insert ON public.admin_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_documents_admin_update ON public.admin_documents
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_documents_admin_delete ON public.admin_documents
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- login_attempts: remove public access, restrict reads to admins
DROP POLICY IF EXISTS "Service role can read login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Service role can delete old login attempts" ON public.login_attempts;
-- service_role bypasses RLS, no policy needed for it. Admin SELECT policy already exists.

-- learner_profiles: replace wide anon policies with learner-scoped ones
DROP POLICY IF EXISTS anon_read_learner_profiles ON public.learner_profiles;
DROP POLICY IF EXISTS anon_update_learner_profiles ON public.learner_profiles;
DROP POLICY IF EXISTS anon_insert_learner_profiles ON public.learner_profiles;

CREATE POLICY anon_read_own_learner_profile ON public.learner_profiles
  FOR SELECT TO anon
  USING (lower(email) = public.get_learner_email());
CREATE POLICY anon_insert_own_learner_profile ON public.learner_profiles
  FOR INSERT TO anon
  WITH CHECK (lower(email) = public.get_learner_email());
CREATE POLICY anon_update_own_learner_profile ON public.learner_profiles
  FOR UPDATE TO anon
  USING (lower(email) = public.get_learner_email())
  WITH CHECK (lower(email) = public.get_learner_email());

-- lms_messages: scope anon access to the learner's own messages
DROP POLICY IF EXISTS anon_read_lms_messages ON public.lms_messages;
DROP POLICY IF EXISTS anon_insert_lms_messages ON public.lms_messages;

CREATE POLICY anon_read_own_lms_messages ON public.lms_messages
  FOR SELECT TO anon
  USING (lower(learner_email) = public.get_learner_email());
CREATE POLICY anon_insert_own_lms_messages ON public.lms_messages
  FOR INSERT TO anon
  WITH CHECK (lower(learner_email) = public.get_learner_email());

-- location_contract_signatures: drop public-all, restrict to admins; writes via service_role
DROP POLICY IF EXISTS location_contract_signatures_public_select ON public.location_contract_signatures;
DROP POLICY IF EXISTS location_contract_signatures_service_insert ON public.location_contract_signatures;
DROP POLICY IF EXISTS location_contract_signatures_service_update ON public.location_contract_signatures;

CREATE POLICY location_contract_signatures_admin_select ON public.location_contract_signatures
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- service_role bypasses RLS; edge functions writing here must use the service role key.

-- questionnaire_besoins: remove anon UPDATE; public form uses RPC update_questionnaire_by_token
DROP POLICY IF EXISTS "Public can update own questionnaire" ON public.questionnaire_besoins;

-- reclamations: remove blanket anon SELECT/UPDATE; public page uses RPCs
DROP POLICY IF EXISTS "Public can view reclamation by token" ON public.reclamations;
DROP POLICY IF EXISTS "Public can update reclamation by token" ON public.reclamations;

-- sponsor_cold_evaluations: remove always-true anon policies; public page uses RPCs
DROP POLICY IF EXISTS "Anonymous can read sponsor cold evaluations by token" ON public.sponsor_cold_evaluations;
DROP POLICY IF EXISTS "Anonymous can update sponsor cold evaluations by token" ON public.sponsor_cold_evaluations;

-- stakeholder_appreciations: remove anon true policies
DROP POLICY IF EXISTS "Public can read appreciation by token" ON public.stakeholder_appreciations;
DROP POLICY IF EXISTS "Public can update appreciation by token" ON public.stakeholder_appreciations;

-- trainer_evaluations: remove anon role-only policies
DROP POLICY IF EXISTS "Public can read own trainer evaluation by token" ON public.trainer_evaluations;
DROP POLICY IF EXISTS "Public can update trainer evaluation by token" ON public.trainer_evaluations;

-- trainers: remove anon SELECT
DROP POLICY IF EXISTS "Public can view trainers" ON public.trainers;

-- training_live_meetings: remove anon SELECT (learners read via RPC get_course_live_meetings)
DROP POLICY IF EXISTS anon_read_live_meetings ON public.training_live_meetings;

-- training_schedules: remove anon SELECT
DROP POLICY IF EXISTS "Public can view training schedules" ON public.training_schedules;

-- Fix update_api_key_last_used: add fixed search_path (SECURITY DEFINER hardening)
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(key_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys SET last_used_at = now() WHERE id = key_id;
END;
$$;
