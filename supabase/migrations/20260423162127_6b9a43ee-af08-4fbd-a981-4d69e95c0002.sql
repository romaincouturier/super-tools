
-- Page views tracking for LMS lessons
CREATE TABLE public.lms_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_page_views_lesson ON public.lms_page_views(lesson_id);
CREATE INDEX idx_lms_page_views_course ON public.lms_page_views(course_id);

ALTER TABLE public.lms_page_views ENABLE ROW LEVEL SECURITY;

-- Learners can insert their own views
CREATE POLICY "Learners can insert own page views"
  ON public.lms_page_views FOR INSERT
  WITH CHECK (lower(learner_email) = public.get_learner_email());

-- Preview mode (admin) can also insert
CREATE POLICY "Authenticated users can insert page views"
  ON public.lms_page_views FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admins can read all page views
CREATE POLICY "Admins can read page views"
  ON public.lms_page_views FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Lesson comments
CREATE TABLE public.lms_lesson_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  learner_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_lesson_comments_lesson ON public.lms_lesson_comments(lesson_id);

ALTER TABLE public.lms_lesson_comments ENABLE ROW LEVEL SECURITY;

-- Learners can insert comments
CREATE POLICY "Learners can insert comments"
  ON public.lms_lesson_comments FOR INSERT
  WITH CHECK (lower(learner_email) = public.get_learner_email());

-- Authenticated users can also insert (preview mode)
CREATE POLICY "Authenticated users can insert comments"
  ON public.lms_lesson_comments FOR INSERT TO authenticated
  WITH CHECK (true);

-- Learners can read comments on their lessons
CREATE POLICY "Learners can read comments"
  ON public.lms_lesson_comments FOR SELECT
  USING (lower(learner_email) = public.get_learner_email());

-- Admins can read all comments
CREATE POLICY "Admins can read all comments"
  ON public.lms_lesson_comments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
