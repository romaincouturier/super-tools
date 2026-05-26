-- Adds home_config (JSONB) to lms_courses so the course-home "Infos pratiques"
-- section is editable from the back-office: training period, objectives,
-- prerequisites, useful documents, instructor block, and the training-plan link.
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS home_config JSONB NOT NULL DEFAULT '{}'::jsonb;
