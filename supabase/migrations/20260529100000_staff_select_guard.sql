-- Security fix: block learner accounts from reading staff-only tables.
-- Extends the write guard (20260521140000) with RESTRICTIVE SELECT policies.
-- is_staff_user() already exists and returns false when user_metadata.role = 'learner'.
--
-- Tables excluded intentionally (learners legitimately read them):
--   lms_courses, lms_modules, lms_lessons, lms_quizzes, lms_quiz_questions,
--   lms_assignments, lms_badges, lms_badge_awards, lms_forums,
--   training_coaching_slots, training_live_meetings, formation_dates, formation_formulas
--   (these are required for the learner portal to function)

DO $outer$
DECLARE
  t text;
  staff_only_tables text[] := ARRAY[
    -- CRM
    'crm_columns', 'crm_tags', 'crm_cards', 'crm_card_tags',
    'crm_attachments', 'crm_comments', 'crm_card_emails', 'crm_activity_log',
    -- Missions
    'missions', 'mission_activities', 'mission_credits', 'mission_media', 'mission_pages',
    -- Quotes / finance
    'quotes', 'quote_settings',
    -- Watch / veille
    'watch_clusters', 'watch_digests', 'watch_items',
    -- Improvements (internal product tracking)
    'improvements',
    -- Newsletters
    'newsletters', 'newsletter_cards',
    -- Email templates
    'email_templates',
    -- Training support materials (formateur-only content)
    'training_supports', 'training_support_sections',
    'training_support_templates', 'training_support_template_sections',
    'training_support_media', 'training_support_imports',
    -- Coaching private notes
    'coaching_summaries',
    -- System / admin
    'evaluation_analyses', 'woocommerce_coupons', 'session_start_notifications',
    -- Agent infrastructure
    'agent_schema_registry'
  ];
BEGIN
  FOREACH t IN ARRAY staff_only_tables LOOP
    -- Check table exists before applying (avoids errors if a table was dropped)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'CREATE POLICY staff_only_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_staff_user())',
        t
      );
    END IF;
  END LOOP;
END $outer$;
