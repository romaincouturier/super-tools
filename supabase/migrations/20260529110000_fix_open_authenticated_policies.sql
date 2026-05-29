-- Security fix: replace open FOR ALL TO authenticated USING (true) policies
-- on tables where learners need scoped access (not blanket access).

-- ── lms_assignment_submissions ──
-- Learners can only manage their own submissions (by learner_email).
-- Staff can do everything.
DROP POLICY IF EXISTS "auth_manage_submissions" ON public.lms_assignment_submissions;

CREATE POLICY "learner_own_submissions" ON public.lms_assignment_submissions
  FOR ALL TO authenticated
  USING (learner_email = (auth.jwt() ->> 'email'))
  WITH CHECK (learner_email = (auth.jwt() ->> 'email'));

CREATE POLICY "staff_all_submissions" ON public.lms_assignment_submissions
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- ── coaching_bookings ──
-- Remove the dangerous anon policy (anonymous users must never access bookings).
-- Learners can only access their own bookings via participant_id.
-- Staff can do everything.
DROP POLICY IF EXISTS "auth_manage_coaching_bookings" ON public.coaching_bookings;
DROP POLICY IF EXISTS "anon_manage_coaching_bookings" ON public.coaching_bookings;

CREATE POLICY "staff_all_coaching_bookings" ON public.coaching_bookings
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- Learners can read bookings linked to their own participant record and create new ones.
-- The participant_id check via training_participants.learner_email ensures isolation.
CREATE POLICY "learner_own_coaching_bookings_select" ON public.coaching_bookings
  FOR SELECT TO authenticated
  USING (
    NOT public.is_staff_user() AND EXISTS (
      SELECT 1 FROM public.training_participants tp
      WHERE tp.id = coaching_bookings.participant_id
        AND tp.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "learner_own_coaching_bookings_insert" ON public.coaching_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_staff_user() AND EXISTS (
      SELECT 1 FROM public.training_participants tp
      WHERE tp.id = coaching_bookings.participant_id
        AND tp.email = (auth.jwt() ->> 'email')
    )
  );

-- ── coaching_summaries ──
-- Private coaching notes — staff only, no learner access.
-- Already covered by staff_only_select in migration 20260529100000,
-- but the open FOR ALL policy must be replaced with a staff-only one.
DROP POLICY IF EXISTS "auth_manage_coaching_summaries" ON public.coaching_summaries;

CREATE POLICY "staff_all_coaching_summaries" ON public.coaching_summaries
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- ── lms_submissions (older submissions table, same pattern) ──
DROP POLICY IF EXISTS "auth_manage_submissions" ON public.lms_submissions;

CREATE POLICY "learner_own_lms_submissions" ON public.lms_submissions
  FOR ALL TO authenticated
  USING (learner_email = (auth.jwt() ->> 'email'))
  WITH CHECK (learner_email = (auth.jwt() ->> 'email'));

CREATE POLICY "staff_all_lms_submissions" ON public.lms_submissions
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- ── email_templates, newsletters, newsletter_cards ──
-- Already protected by RESTRICTIVE SELECT guard (20260529100000).
-- The old FOR ALL TO authenticated policies grant write access to learners —
-- add RESTRICTIVE write guard here too (tables not in the write guard list).
DO $block$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_templates', 'newsletters', 'newsletter_cards'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      BEGIN
        EXECUTE format('CREATE POLICY staff_only_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_staff_user())', t);
        EXECUTE format('CREATE POLICY staff_only_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user())', t);
        EXECUTE format('CREATE POLICY staff_only_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_staff_user())', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $block$;

-- ── agent_schema_registry ──
-- The schema registry exposes the database structure used by the AI agent.
-- Revealing it to learners aids in crafting targeted data extraction queries.
-- Staff only.
DROP POLICY IF EXISTS "agent_schema_select" ON public.agent_schema_registry;

CREATE POLICY "agent_schema_select" ON public.agent_schema_registry
  FOR SELECT TO authenticated
  USING (public.is_staff_user());
