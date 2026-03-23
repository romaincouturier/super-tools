-- Fix RLS USING(true) for anon role on LMS and coaching tables
-- These policies were too permissive, allowing any anonymous user
-- to read/write all data without identity verification.

-- ============================================================
-- 1. Helper function: extract verified learner email from header
-- ============================================================

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

  -- Verify the email belongs to a known participant or validated magic link
  IF EXISTS (
    SELECT 1 FROM training_participants WHERE lower(email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM learner_magic_links
    WHERE lower(email) = v_email AND used_at IS NOT NULL
  ) THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 2. Drop vulnerable anon policies
-- ============================================================

-- LMS policies (from 20260308224610 migration)
DROP POLICY IF EXISTS "anon_read_modules" ON lms_modules;
DROP POLICY IF EXISTS "anon_read_lessons" ON lms_lessons;
DROP POLICY IF EXISTS "anon_read_quizzes" ON lms_quizzes;
DROP POLICY IF EXISTS "anon_read_quiz_questions" ON lms_quiz_questions;
DROP POLICY IF EXISTS "anon_manage_attempts" ON lms_quiz_attempts;
DROP POLICY IF EXISTS "anon_manage_progress" ON lms_progress;
DROP POLICY IF EXISTS "anon_read_assignments" ON lms_assignments;
DROP POLICY IF EXISTS "anon_manage_submissions" ON lms_submissions;
DROP POLICY IF EXISTS "anon_read_badges" ON lms_badges;
DROP POLICY IF EXISTS "anon_read_user_badges" ON lms_user_badges;
DROP POLICY IF EXISTS "anon_read_forums" ON lms_forums;
DROP POLICY IF EXISTS "anon_manage_forum_posts" ON lms_forum_posts;
DROP POLICY IF EXISTS "anon_manage_enrollments" ON lms_enrollments;

-- Coaching policy (from 20260308225436 migration)
DROP POLICY IF EXISTS "anon_manage_coaching_bookings" ON coaching_bookings;

-- ============================================================
-- 3. Recreate SELECT policies scoped to published courses
-- ============================================================

-- Modules: only for published courses
CREATE POLICY "anon_read_modules" ON lms_modules
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_courses c
    WHERE c.id = lms_modules.course_id AND c.status = 'published'
  ));

-- Lessons: only for published courses (via module)
CREATE POLICY "anon_read_lessons" ON lms_lessons
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_modules m
    JOIN lms_courses c ON c.id = m.course_id
    WHERE m.id = lms_lessons.module_id AND c.status = 'published'
  ));

-- Quizzes: only for published courses (via course_id)
CREATE POLICY "anon_read_quizzes" ON lms_quizzes
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_courses c
    WHERE c.id = lms_quizzes.course_id AND c.status = 'published'
  ));

-- Quiz questions: only for published courses (via quiz -> course)
CREATE POLICY "anon_read_quiz_questions" ON lms_quiz_questions
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_quizzes q
    JOIN lms_courses c ON c.id = q.course_id
    WHERE q.id = lms_quiz_questions.quiz_id AND c.status = 'published'
  ));

-- Assignments: only for published courses (via course_id)
CREATE POLICY "anon_read_assignments" ON lms_assignments
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_courses c
    WHERE c.id = lms_assignments.course_id AND c.status = 'published'
  ));

-- Badges: only for published courses
CREATE POLICY "anon_read_badges" ON lms_badges
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_courses c
    WHERE c.id = lms_badges.course_id AND c.status = 'published'
  ));

-- User badges: only own badges (by learner email)
CREATE POLICY "anon_read_user_badges" ON lms_user_badges
  FOR SELECT TO anon
  USING (lower(learner_email) = get_learner_email());

-- Forums: only for published courses
CREATE POLICY "anon_read_forums" ON lms_forums
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM lms_courses c
    WHERE c.id = lms_forums.course_id AND c.status = 'published'
  ));

-- ============================================================
-- 4. Recreate write policies with learner email verification
-- ============================================================

-- Quiz attempts: learner can only manage their own
CREATE POLICY "anon_manage_attempts" ON lms_quiz_attempts
  FOR ALL TO anon
  USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

-- Progress: learner can only manage their own
CREATE POLICY "anon_manage_progress" ON lms_progress
  FOR ALL TO anon
  USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

-- Submissions: learner can only manage their own
CREATE POLICY "anon_manage_submissions" ON lms_submissions
  FOR ALL TO anon
  USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

-- Forum posts: learner can only manage their own
CREATE POLICY "anon_manage_forum_posts" ON lms_forum_posts
  FOR ALL TO anon
  USING (lower(author_email) = get_learner_email())
  WITH CHECK (lower(author_email) = get_learner_email());

-- Enrollments: learner can only manage their own
CREATE POLICY "anon_manage_enrollments" ON lms_enrollments
  FOR ALL TO anon
  USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

-- Coaching bookings: via participant_id -> training_participants.email
CREATE POLICY "anon_manage_coaching_bookings" ON coaching_bookings
  FOR ALL TO anon
  USING (EXISTS (
    SELECT 1 FROM training_participants tp
    WHERE tp.id = coaching_bookings.participant_id
    AND lower(tp.email) = get_learner_email()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM training_participants tp
    WHERE tp.id = coaching_bookings.participant_id
    AND lower(tp.email) = get_learner_email()
  ));
