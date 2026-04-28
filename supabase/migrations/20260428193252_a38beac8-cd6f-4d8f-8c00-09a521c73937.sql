
ALTER TABLE public.scheduled_emails
DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

ALTER TABLE public.scheduled_emails
ADD CONSTRAINT scheduled_emails_email_type_check
CHECK (email_type = ANY (ARRAY[
  'welcome'::text, 'needs_survey'::text, 'needs_survey_reminder'::text,
  'evaluation_reminder'::text, 'evaluation_reminder_1'::text, 'evaluation_reminder_2'::text,
  'training_documents'::text, 'thank_you'::text, 'calendar_invite'::text,
  'elearning_access'::text, 'certificate'::text, 'accessibility_needs'::text,
  'prerequis_warning'::text, 'convention_email'::text, 'convention_reminder'::text,
  'trainer_summary'::text, 'google_review'::text, 'video_testimonial'::text,
  'cold_evaluation'::text, 'funder_reminder'::text, 'participant_list_reminder'::text,
  'live_reminder'::text, 'coaching_reminder'::text, 'coaching_booking_invite'::text,
  'follow_up_news'::text
]));
