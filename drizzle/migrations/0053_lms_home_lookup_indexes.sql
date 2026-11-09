CREATE INDEX IF NOT EXISTS training_participants_lower_email_training_idx ON public.training_participants (lower(email), training_id);
CREATE INDEX IF NOT EXISTS lms_enrollments_lower_email_course_idx ON public.lms_enrollments (lower(learner_email), course_id);
CREATE INDEX IF NOT EXISTS lms_progress_course_learner_idx ON public.lms_progress (course_id, learner_email);
CREATE INDEX IF NOT EXISTS practice_posts_course_preview_idx ON public.practice_posts (course_id, is_pinned DESC, created_at DESC);