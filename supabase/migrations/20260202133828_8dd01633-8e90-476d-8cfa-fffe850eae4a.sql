-- Add status to individual comments (handled by author)
ALTER TABLE public.review_comments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'refused', 'corrected'));

ALTER TABLE public.review_comments 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Simplify review status: just tracks if review is open or closed
-- Remove the reviewer-controlled statuses, add reminder tracking
ALTER TABLE public.content_reviews 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Update the review_status enum to simpler values
-- We'll use the status column differently: pending = waiting for reviewer, in_review = has comments, closed = author closed it
COMMENT ON COLUMN public.content_reviews.status IS 'pending = awaiting reviewer, in_review = reviewer commented, approved = closed by author';