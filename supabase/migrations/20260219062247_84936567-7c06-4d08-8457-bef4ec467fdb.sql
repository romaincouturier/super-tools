-- Add participant_list_reminder to the email type check constraint (including all existing types)
ALTER TABLE public.scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;
ALTER TABLE public.scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check CHECK (
  email_type IN (
    'needs_survey', 'needs_survey_reminder', 'evaluation_reminder',
    'evaluation_reminder_1', 'evaluation_reminder_2',
    'training_documents', 'thank_you', 'calendar_invite',
    'elearning_access', 'certificate', 'accessibility_needs',
    'prerequis_warning', 'convention_email', 'convention_reminder',
    'trainer_summary', 'google_review', 'video_testimonial',
    'cold_evaluation', 'funder_reminder', 'participant_list_reminder'
  )
);