-- Stage 1 of ST-2026-0043 — "Dépôt de travail"
--
-- Adds the per-lesson opt-in for the deposit feature on lms_lessons,
-- creates the three tables required by the spec (deposits, comments,
-- supertilt feedback) and wires RLS so authenticated SuperTilt has full
-- CRUD while anonymous learners are scoped to their own deposits and
-- whatever is shared inside courses they are enrolled in.
--
-- Stage 2 will surface the comments UI; Stage 3 the feedback + email;
-- Stage 4 the BO admin interface; Stage 5 a mobile QA pass.

-- ── Lesson-level configuration ──────────────────────────────────────
ALTER TABLE public.lms_lessons
  ADD COLUMN IF NOT EXISTS work_deposit_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_deposit_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.lms_lessons.work_deposit_config IS
  'Carries the deposit block config: { title, instructions_html, expected_deliverable, accepted_formats[], max_size_mb, sharing_allowed, comments_enabled, feedback_enabled }';

-- ── Helper: can the current learner see deposits/comments tied to this course? ──
-- Returns true when there is an enrollment row matching the learner email
-- exposed by get_learner_email() (set by createLearnerClient via the
-- x-learner-email header).
CREATE OR REPLACE FUNCTION public.lms_learner_is_enrolled(_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := get_learner_email();
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.lms_enrollments
    WHERE course_id = _course_id AND learner_email = v_email
  );
END;
$$;

-- ── Deposits table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_work_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.lms_modules(id) ON DELETE SET NULL,
  learner_email TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  file_mime TEXT,
  comment TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('published', 'hidden')),
  pedagogical_status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    pedagogical_status IN ('submitted', 'seen', 'feedback_received', 'needs_completion', 'validated')
  ),
  visibility_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, learner_email)
);

CREATE INDEX IF NOT EXISTS lms_work_deposits_course_idx ON public.lms_work_deposits (course_id);
CREATE INDEX IF NOT EXISTS lms_work_deposits_learner_idx ON public.lms_work_deposits (learner_email);
CREATE INDEX IF NOT EXISTS lms_work_deposits_lesson_visibility_idx ON public.lms_work_deposits (lesson_id, visibility, publication_status);

ALTER TABLE public.lms_work_deposits ENABLE ROW LEVEL SECURITY;

-- Authenticated SuperTilt: full CRUD
CREATE POLICY "auth_manage_work_deposits"
  ON public.lms_work_deposits
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon learner: see own deposits + shared+published deposits in courses they're enrolled in
CREATE POLICY "anon_read_work_deposits"
  ON public.lms_work_deposits
  FOR SELECT TO anon
  USING (
    learner_email = get_learner_email()
    OR (
      visibility = 'shared'
      AND publication_status = 'published'
      AND lms_learner_is_enrolled(course_id)
    )
  );

-- Anon learner: insert their own deposit on lessons that have the feature enabled
CREATE POLICY "anon_insert_work_deposits"
  ON public.lms_work_deposits
  FOR INSERT TO anon
  WITH CHECK (
    learner_email = get_learner_email()
    AND EXISTS (
      SELECT 1 FROM public.lms_lessons l
      WHERE l.id = lesson_id AND l.work_deposit_enabled = true
    )
    AND lms_learner_is_enrolled(course_id)
  );

-- Anon learner: update their own deposit (visibility toggle, comment edit, file replace…)
CREATE POLICY "anon_update_work_deposits"
  ON public.lms_work_deposits
  FOR UPDATE TO anon
  USING (learner_email = get_learner_email())
  WITH CHECK (learner_email = get_learner_email());

-- Anon learner: delete their own deposit
CREATE POLICY "anon_delete_work_deposits"
  ON public.lms_work_deposits
  FOR DELETE TO anon
  USING (learner_email = get_learner_email());

-- ── Comments table (used in Stage 2) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_deposit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES public.lms_work_deposits(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lms_deposit_comments_deposit_idx ON public.lms_deposit_comments (deposit_id, created_at);

ALTER TABLE public.lms_deposit_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_deposit_comments"
  ON public.lms_deposit_comments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: read published comments on deposits the learner can already see
CREATE POLICY "anon_read_deposit_comments"
  ON public.lms_deposit_comments
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.lms_work_deposits d
      WHERE d.id = lms_deposit_comments.deposit_id
        AND (
          d.learner_email = get_learner_email()
          OR (
            d.visibility = 'shared'
            AND d.publication_status = 'published'
            AND lms_learner_is_enrolled(d.course_id)
          )
        )
    )
  );

-- Anon: insert a comment with their own email on shared deposits in courses they're enrolled in
CREATE POLICY "anon_insert_deposit_comments"
  ON public.lms_deposit_comments
  FOR INSERT TO anon
  WITH CHECK (
    author_email = get_learner_email()
    AND EXISTS (
      SELECT 1 FROM public.lms_work_deposits d
      WHERE d.id = deposit_id
        AND d.visibility = 'shared'
        AND d.publication_status = 'published'
        AND lms_learner_is_enrolled(d.course_id)
    )
  );

-- Anon: update/delete their own comments
CREATE POLICY "anon_update_deposit_comments"
  ON public.lms_deposit_comments
  FOR UPDATE TO anon
  USING (author_email = get_learner_email())
  WITH CHECK (author_email = get_learner_email());

CREATE POLICY "anon_delete_deposit_comments"
  ON public.lms_deposit_comments
  FOR DELETE TO anon
  USING (author_email = get_learner_email());

-- ── SuperTilt feedback table (used in Stage 3) ─────────────────────
CREATE TABLE IF NOT EXISTS public.lms_deposit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES public.lms_work_deposits(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lms_deposit_feedback_deposit_idx ON public.lms_deposit_feedback (deposit_id, created_at);

ALTER TABLE public.lms_deposit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_deposit_feedback"
  ON public.lms_deposit_feedback
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: read feedback on deposits the learner can already see (visibility inherits)
CREATE POLICY "anon_read_deposit_feedback"
  ON public.lms_deposit_feedback
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.lms_work_deposits d
      WHERE d.id = lms_deposit_feedback.deposit_id
        AND (
          d.learner_email = get_learner_email()
          OR (
            d.visibility = 'shared'
            AND d.publication_status = 'published'
            AND lms_learner_is_enrolled(d.course_id)
          )
        )
    )
  );

-- ── updated_at triggers ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_lms_work_deposit_tables()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lms_work_deposits_updated_at
  BEFORE UPDATE ON public.lms_work_deposits
  FOR EACH ROW EXECUTE FUNCTION public.touch_lms_work_deposit_tables();

CREATE TRIGGER lms_deposit_comments_updated_at
  BEFORE UPDATE ON public.lms_deposit_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_lms_work_deposit_tables();

CREATE TRIGGER lms_deposit_feedback_updated_at
  BEFORE UPDATE ON public.lms_deposit_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_lms_work_deposit_tables();

-- visibility_changed_at trigger
CREATE OR REPLACE FUNCTION public.touch_lms_work_deposit_visibility()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    NEW.visibility_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lms_work_deposits_visibility
  BEFORE UPDATE ON public.lms_work_deposits
  FOR EACH ROW EXECUTE FUNCTION public.touch_lms_work_deposit_visibility();
