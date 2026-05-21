-- Security fix: block learner accounts from writing to staff-only tables.
-- Learners authenticate via Supabase magic link with user_metadata.role = 'learner'.
-- They pass the 'authenticated' RLS role check, so we need an explicit guard.
--
-- Strategy: RESTRICTIVE policies (must pass all restrictive + at least one permissive).
-- This adds a non-bypassable condition on top of existing permissive policies.

-- Helper: returns false when the caller is a learner JWT, true for all staff.
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'learner',
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;

-- Apply restrictive write guard to all staff-only tables.
-- Learners can still SELECT (read-only leak is low-risk vs write access).
DO $outer$
DECLARE
  t text;
  staff_tables text[] := ARRAY[
    -- Missions module
    'missions', 'mission_activities', 'mission_credits', 'mission_media', 'mission_pages',
    -- Newsletters
    'newsletters', 'newsletter_cards',
    -- Improvements tracking
    'improvements',
    -- Events
    'events', 'event_media', 'event_shares',
    -- Quotes / CRM
    'quotes', 'quote_settings',
    -- Veille (watch)
    'watch_clusters', 'watch_digests', 'watch_items',
    -- LMS admin (courses, content structure)
    'lms_courses', 'lms_modules', 'lms_lessons',
    'lms_assignments', 'lms_badges', 'lms_badge_awards',
    'lms_forums', 'lms_quiz_questions', 'lms_quizzes',
    -- Training support content
    'training_supports', 'training_support_sections',
    'training_support_templates', 'training_support_template_sections',
    'training_support_media', 'training_support_imports',
    -- Coaching / scheduling
    'coaching_summaries', 'training_coaching_slots', 'training_live_meetings',
    -- Formation configuration
    'formation_dates', 'formation_formulas',
    -- System / admin
    'email_templates', 'evaluation_analyses',
    'woocommerce_coupons', 'session_start_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    EXECUTE format(
      'CREATE POLICY staff_only_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_staff_user())',
      t
    );
    EXECUTE format(
      'CREATE POLICY staff_only_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user())',
      t
    );
    EXECUTE format(
      'CREATE POLICY staff_only_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_staff_user())',
      t
    );
  END LOOP;
END $outer$;
