-- Étendre la contrainte pour inclure les nouveaux types de relance d'évaluation
ALTER TABLE public.scheduled_emails 
DROP CONSTRAINT scheduled_emails_email_type_check;

ALTER TABLE public.scheduled_emails 
ADD CONSTRAINT scheduled_emails_email_type_check 
CHECK (email_type = ANY (ARRAY[
  'needs_survey'::text, 
  'training_documents'::text, 
  'thank_you'::text, 
  'google_review'::text, 
  'video_testimonial'::text, 
  'cold_evaluation'::text, 
  'funder_reminder'::text,
  'evaluation_reminder_1'::text,
  'evaluation_reminder_2'::text
]));