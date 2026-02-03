-- Add proposed_correction column to review_comments
-- This allows reviewers to optionally suggest a correction alongside their comment

ALTER TABLE public.review_comments
ADD COLUMN IF NOT EXISTS proposed_correction TEXT;

COMMENT ON COLUMN public.review_comments.proposed_correction IS
'Optional proposed correction text that the reviewer can suggest to fix the issue mentioned in the comment.';
