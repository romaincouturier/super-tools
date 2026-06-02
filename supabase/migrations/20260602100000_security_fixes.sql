-- ============================================================
-- Security fixes — 2026-06-02
-- ============================================================

-- ── 1. training_participants: drop unnecessary anon UPDATE policies ───────────
--
-- The legit update path is:
--   questionnaire submission → supabase.rpc("update_participant_after_questionnaire")
--   which is SECURITY DEFINER and runs as owner, bypassing RLS entirely.
-- The anon UPDATE policies were unused and allowed overwriting any column
-- on any participant row whose needs_survey_token IS NOT NULL.

DROP POLICY IF EXISTS "Public can update participant survey status"
  ON public.training_participants;

DROP POLICY IF EXISTS "Public can update participant survey status via token"
  ON public.training_participants;


-- ── 2. learner_magic_links: drop unnecessary anon INSERT policy ───────────────
--
-- All magic link inserts go through the send-learner-magic-link edge function
-- which uses the service role key and therefore bypasses RLS. No anon direct
-- INSERT is ever performed from the frontend.

DROP POLICY IF EXISTS "Anyone can request magic link"
  ON public.learner_magic_links;


-- ── 3. learner_profiles: restrict anon access to own row ─────────────────────
--
-- get_learner_email() reads the x-learner-email header set by createLearnerClient()
-- and validates it against training_participants / lms_enrollments.
-- It is already used on practice_posts, reactions, comments, etc.
-- Staff reads all profiles via the authenticated policy which is unchanged.

DROP POLICY IF EXISTS "anon_read_learner_profiles"   ON public.learner_profiles;
DROP POLICY IF EXISTS "anon_insert_learner_profiles" ON public.learner_profiles;
DROP POLICY IF EXISTS "anon_update_learner_profiles" ON public.learner_profiles;

CREATE POLICY "anon_read_own_learner_profile" ON public.learner_profiles
  FOR SELECT TO anon
  USING (lower(email) = get_learner_email());

CREATE POLICY "anon_insert_own_learner_profile" ON public.learner_profiles
  FOR INSERT TO anon
  WITH CHECK (lower(email) = get_learner_email());

CREATE POLICY "anon_update_own_learner_profile" ON public.learner_profiles
  FOR UPDATE TO anon
  USING  (lower(email) = get_learner_email())
  WITH CHECK (lower(email) = get_learner_email());
