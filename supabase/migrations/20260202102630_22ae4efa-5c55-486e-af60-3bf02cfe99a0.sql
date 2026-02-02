-- Drop existing check constraint on email_type
ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

-- Add new check constraint with all email types including post-training sequence
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check 
CHECK (email_type IN (
  'needs_survey', 
  'training_documents', 
  'thank_you', 
  'google_review', 
  'video_testimonial', 
  'cold_evaluation',
  'funder_reminder'
));