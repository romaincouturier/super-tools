ALTER TABLE public.scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

ALTER TABLE public.scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check 
CHECK (email_type IN ('needs_survey', 'reminder_j7', 'needs_summary', 'trainer_summary', 'thank_you', 'relance', 'welcome', 'reminder', 'google_review', 'video_testimonial', 'cold_evaluation', 'funder_reminder', 'evaluation_reminder_1', 'evaluation_reminder_2', 'convocation'));