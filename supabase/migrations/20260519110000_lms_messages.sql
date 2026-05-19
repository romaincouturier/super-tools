-- ============================================================
-- lms_messages: messages between learners and LMS managers,
-- scoped to a course (not a training session).
-- The admin side is consolidated in the /lms/messages view.
-- ============================================================

CREATE TABLE public.lms_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  sender_role  TEXT NOT NULL CHECK (sender_role IN ('learner', 'admin')),
  sender_email TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lms_messages ENABLE ROW LEVEL SECURITY;

-- Anon (learners) can insert and read messages for their own email
CREATE POLICY "anon_insert_lms_messages" ON public.lms_messages
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_read_lms_messages" ON public.lms_messages
  FOR SELECT TO anon USING (true);

-- Admin (authenticated) can do everything
CREATE POLICY "auth_manage_lms_messages" ON public.lms_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_lms_messages_course   ON public.lms_messages(course_id);
CREATE INDEX idx_lms_messages_learner  ON public.lms_messages(lower(learner_email));
CREATE INDEX idx_lms_messages_created  ON public.lms_messages(created_at);
