-- Gardes de rejeu ajoutés (règle [042b]) : la migration est déjà appliquée
-- en production, seul le rejeu sur base vierge change.
-- 1) Learner identity: also resolve from the authenticated JWT email
CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  v_email := lower(
    (current_setting('request.headers', true)::json->>'x-learner-email')
  );
  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(auth.jwt() ->> 'email');
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;
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
$function$;

-- 2) Published course content: readable by signed-in users too
DROP POLICY IF EXISTS auth_read_published_courses ON public.lms_courses;
CREATE POLICY auth_read_published_courses ON public.lms_courses
  FOR SELECT TO authenticated USING (status = 'published');

DROP POLICY IF EXISTS auth_read_modules ON public.lms_modules;
CREATE POLICY auth_read_modules ON public.lms_modules
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_courses c WHERE c.id = lms_modules.course_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_lessons ON public.lms_lessons;
CREATE POLICY auth_read_lessons ON public.lms_lessons
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_modules m JOIN lms_courses c ON c.id = m.course_id
    WHERE m.id = lms_lessons.module_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_quizzes ON public.lms_quizzes;
CREATE POLICY auth_read_quizzes ON public.lms_quizzes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_courses c WHERE c.id = lms_quizzes.course_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_quiz_questions ON public.lms_quiz_questions;
CREATE POLICY auth_read_quiz_questions ON public.lms_quiz_questions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_quizzes q JOIN lms_courses c ON c.id = q.course_id
    WHERE q.id = lms_quiz_questions.quiz_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_assignments ON public.lms_assignments;
CREATE POLICY auth_read_assignments ON public.lms_assignments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_courses c WHERE c.id = lms_assignments.course_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_forums ON public.lms_forums;
CREATE POLICY auth_read_forums ON public.lms_forums
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM lms_courses c WHERE c.id = lms_forums.course_id AND c.status = 'published'));

DROP POLICY IF EXISTS auth_read_badges ON public.lms_badges;
CREATE POLICY auth_read_badges ON public.lms_badges
  FOR SELECT TO authenticated USING (true);

-- 3) Learner-scoped data: same rules as the magic-link portal
DROP POLICY IF EXISTS auth_learner_enrollments ON public.lms_enrollments;
CREATE POLICY auth_learner_enrollments ON public.lms_enrollments
  FOR SELECT TO authenticated USING (lower(learner_email) = get_learner_email());

DROP POLICY IF EXISTS auth_learner_progress ON public.lms_progress;
CREATE POLICY auth_learner_progress ON public.lms_progress
  FOR ALL TO authenticated USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

DROP POLICY IF EXISTS auth_learner_quiz_attempts ON public.lms_quiz_attempts;
CREATE POLICY auth_learner_quiz_attempts ON public.lms_quiz_attempts
  FOR ALL TO authenticated USING (lower(learner_email) = get_learner_email())
  WITH CHECK (lower(learner_email) = get_learner_email());

DROP POLICY IF EXISTS auth_learner_forum_posts ON public.lms_forum_posts;
CREATE POLICY auth_learner_forum_posts ON public.lms_forum_posts
  FOR ALL TO authenticated USING (lower(author_email) = get_learner_email())
  WITH CHECK (lower(author_email) = get_learner_email());

DROP POLICY IF EXISTS auth_learner_messages ON public.lms_messages;
CREATE POLICY auth_learner_messages ON public.lms_messages
  FOR SELECT TO authenticated USING (lower(learner_email) = get_learner_email());

GRANT SELECT ON public.lms_courses, public.lms_modules, public.lms_lessons,
  public.lms_quizzes, public.lms_quiz_questions, public.lms_assignments,
  public.lms_forums, public.lms_badges, public.lms_enrollments, public.lms_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lms_progress, public.lms_quiz_attempts, public.lms_forum_posts TO authenticated;