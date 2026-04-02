-- Add intermediate draft statuses to testimonial_status CHECK constraint
-- These are needed for the new draft-based email validation workflow.

ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS missions_testimonial_status_check;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_testimonial_status_check
  CHECK (testimonial_status IN (
    'pending',
    'google_review_draft',
    'google_review_sent',
    'video_testimonial_draft',
    'video_testimonial_sent',
    'completed'
  ));
