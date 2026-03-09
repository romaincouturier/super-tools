
-- Badge awards table (lms_badges is badge definitions)
CREATE TABLE public.lms_badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID REFERENCES public.lms_badges(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  badge_type TEXT NOT NULL DEFAULT 'course_completed',
  badge_name TEXT NOT NULL,
  badge_icon TEXT DEFAULT '🎓',
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(course_id, learner_email, badge_type)
);

ALTER TABLE public.lms_badge_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_badge_awards" ON public.lms_badge_awards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update trigger to use new table
CREATE OR REPLACE FUNCTION public.lms_auto_award_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_course_id UUID; v_total INT; v_done INT; v_title TEXT;
BEGIN
  v_course_id := NEW.course_id;
  SELECT COUNT(*) INTO v_total FROM lms_lessons l JOIN lms_modules m ON m.id = l.module_id WHERE m.course_id = v_course_id AND l.is_mandatory = true;
  SELECT COUNT(*) INTO v_done FROM lms_progress p JOIN lms_lessons l ON l.id = p.lesson_id JOIN lms_modules m ON m.id = l.module_id WHERE m.course_id = v_course_id AND p.learner_email = NEW.learner_email AND p.status = 'completed' AND l.is_mandatory = true;
  IF v_total > 0 AND v_done >= v_total THEN
    SELECT title INTO v_title FROM lms_courses WHERE id = v_course_id;
    INSERT INTO lms_badge_awards (course_id, learner_email, badge_type, badge_name, badge_icon, metadata)
    VALUES (v_course_id, NEW.learner_email, 'course_completed', 'Cours terminé : ' || v_title, '🎓', jsonb_build_object('completed_at', now(), 'lessons_count', v_total))
    ON CONFLICT (course_id, learner_email, badge_type) DO NOTHING;
    UPDATE lms_enrollments SET completed_at = now(), completion_percentage = 100, status = 'completed' WHERE course_id = v_course_id AND learner_email = NEW.learner_email;
  ELSE
    UPDATE lms_enrollments SET completion_percentage = CASE WHEN v_total > 0 THEN ROUND((v_done::NUMERIC / v_total) * 100) ELSE 0 END WHERE course_id = v_course_id AND learner_email = NEW.learner_email;
  END IF;
  RETURN NEW;
END; $$;
