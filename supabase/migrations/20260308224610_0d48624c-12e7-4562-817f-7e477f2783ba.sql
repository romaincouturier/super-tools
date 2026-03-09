
-- =============================================
-- LMS NATIVE SCHEMA — M7.1
-- =============================================

-- Courses
CREATE TABLE public.lms_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  formation_config_id UUID REFERENCES public.formation_configs(id),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  difficulty_level TEXT DEFAULT 'beginner', -- beginner, intermediate, advanced
  estimated_duration_minutes INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modules (sections within a course)
CREATE TABLE public.lms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  is_prerequisite_gated BOOLEAN DEFAULT false,
  prerequisite_module_id UUID REFERENCES public.lms_modules(id),
  unlock_after_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lessons (content within a module)
CREATE TABLE public.lms_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT 'text', -- text, video, quiz, assignment
  content_html TEXT,
  video_url TEXT,
  video_duration_seconds INT,
  quiz_id UUID, -- populated later via FK
  assignment_id UUID, -- populated later via FK
  position INT NOT NULL DEFAULT 0,
  estimated_minutes INT DEFAULT 5,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interactive Quizzes
CREATE TABLE public.lms_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INT DEFAULT 70, -- percentage
  max_attempts INT DEFAULT 3,
  time_limit_minutes INT,
  shuffle_questions BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from lessons to quizzes
ALTER TABLE public.lms_lessons 
  ADD CONSTRAINT lms_lessons_quiz_id_fkey 
  FOREIGN KEY (quiz_id) REFERENCES public.lms_quizzes(id) ON DELETE SET NULL;

-- Quiz Questions
CREATE TABLE public.lms_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'mcq', -- mcq, true_false, open, fill_blank, matching
  question_text TEXT NOT NULL,
  explanation TEXT,
  points INT DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]', -- [{label, is_correct, feedback}]
  correct_answer TEXT, -- for open/fill_blank
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz Attempts
CREATE TABLE public.lms_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  score INT,
  max_score INT,
  percentage NUMERIC(5,2),
  passed BOOLEAN,
  answers JSONB DEFAULT '[]', -- [{question_id, answer, is_correct, points_earned}]
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INT
);

-- Progress Tracking
CREATE TABLE public.lms_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, completed
  completed_at TIMESTAMPTZ,
  time_spent_seconds INT DEFAULT 0,
  last_position TEXT, -- for video bookmarks etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, learner_email)
);

-- Assignments
CREATE TABLE public.lms_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions_html TEXT,
  max_score INT DEFAULT 100,
  due_after_days INT, -- relative to enrollment
  allow_late_submission BOOLEAN DEFAULT true,
  allowed_file_types TEXT[] DEFAULT '{pdf,docx,pptx,zip,jpg,png}',
  max_file_size_mb INT DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from lessons to assignments
ALTER TABLE public.lms_lessons 
  ADD CONSTRAINT lms_lessons_assignment_id_fkey 
  FOREIGN KEY (assignment_id) REFERENCES public.lms_assignments(id) ON DELETE SET NULL;

-- Assignment Submissions
CREATE TABLE public.lms_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.lms_assignments(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted, reviewed, revision_requested
  score INT,
  feedback_html TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badges / Gamification
CREATE TABLE public.lms_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  badge_type TEXT NOT NULL DEFAULT 'achievement', -- achievement, completion, streak, custom
  criteria JSONB DEFAULT '{}', -- {type: 'course_complete', course_id: ...} or {type: 'quiz_score', min_score: 90}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lms_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES public.lms_badges(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(badge_id, learner_email)
);

-- Discussion Forums
CREATE TABLE public.lms_forums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lms_forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id UUID NOT NULL REFERENCES public.lms_forums(id) ON DELETE CASCADE,
  parent_post_id UUID REFERENCES public.lms_forum_posts(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course Enrollments
CREATE TABLE public.lms_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused, dropped
  UNIQUE(course_id, learner_email)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;

-- Authenticated users (instructors) can manage courses
CREATE POLICY "auth_manage_courses" ON public.lms_courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_modules" ON public.lms_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_lessons" ON public.lms_lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_quizzes" ON public.lms_quizzes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_quiz_questions" ON public.lms_quiz_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_assignments" ON public.lms_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_badges" ON public.lms_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_forums" ON public.lms_forums FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Authenticated can view all progress/attempts/submissions/enrollments
CREATE POLICY "auth_manage_attempts" ON public.lms_quiz_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_progress" ON public.lms_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_submissions" ON public.lms_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_user_badges" ON public.lms_user_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_forum_posts" ON public.lms_forum_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_enrollments" ON public.lms_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon access for learners (via email-based queries from edge functions / learner portal)
CREATE POLICY "anon_read_published_courses" ON public.lms_courses FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "anon_read_modules" ON public.lms_modules FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_lessons" ON public.lms_lessons FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_quizzes" ON public.lms_quizzes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_quiz_questions" ON public.lms_quiz_questions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_manage_attempts" ON public.lms_quiz_attempts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_manage_progress" ON public.lms_progress FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_assignments" ON public.lms_assignments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_manage_submissions" ON public.lms_submissions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_badges" ON public.lms_badges FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_user_badges" ON public.lms_user_badges FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_forums" ON public.lms_forums FOR SELECT TO anon USING (true);
CREATE POLICY "anon_manage_forum_posts" ON public.lms_forum_posts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_manage_enrollments" ON public.lms_enrollments FOR ALL TO anon USING (true) WITH CHECK (true);

-- Storage bucket for LMS content
INSERT INTO storage.buckets (id, name, public) VALUES ('lms-content', 'lms-content', true);

CREATE POLICY "auth_upload_lms" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lms-content');
CREATE POLICY "auth_update_lms" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lms-content');
CREATE POLICY "auth_delete_lms" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lms-content');
CREATE POLICY "public_read_lms" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'lms-content');

-- Add LMS to module access enum if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lms' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_module')) THEN
    ALTER TYPE public.app_module ADD VALUE 'lms';
  END IF;
END $$;
