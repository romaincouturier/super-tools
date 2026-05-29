-- Fix: get_learner_email() was only validating against training_participants and
-- learner_magic_links. Learners enrolled directly via lms_enrollments (pure
-- e-learning, no training session) were not in training_participants and had no
-- magic link, so get_learner_email() returned NULL for them.
-- This caused all anon RLS policies (practice_posts, reactions, comments, etc.)
-- to block reads — resulting in an empty community feed for new learners.
--
-- Fix: also accept emails present in lms_enrollments.

CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  -- Extract email from custom header passed by the frontend
  v_email := lower(
    (current_setting('request.headers', true)::json->>'x-learner-email')
  );

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- Verify the email belongs to a known participant, validated magic link,
  -- or a direct e-learning enrollment (lms_enrollments).
  IF EXISTS (
    SELECT 1 FROM training_participants WHERE lower(email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM learner_magic_links
    WHERE lower(email) = v_email AND used_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
  ) THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;
