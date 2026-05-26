-- Restore anon SELECT on learner_profiles so community author names/photos
-- display correctly for learners. The security fix (2026-05-26 RLS batch)
-- scoped reads to own email only, which broke cross-learner display names.
-- Writes remain scoped (own email only via anon_insert/update_own_learner_profile).
DROP POLICY IF EXISTS anon_read_own_learner_profile ON public.learner_profiles;

CREATE POLICY anon_read_learner_profiles ON public.learner_profiles
  FOR SELECT TO anon
  USING (true);
