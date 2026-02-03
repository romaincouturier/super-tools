-- Enhance review_comments with additional fields
-- 1. comment_type: fond (content) or forme (style/form)
-- 2. image_url: for screenshot attachments

ALTER TABLE public.review_comments
ADD COLUMN IF NOT EXISTS comment_type TEXT CHECK (comment_type IN ('fond', 'forme'));

ALTER TABLE public.review_comments
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.review_comments.comment_type IS
'Type of comment: fond (content/substance) or forme (style/formatting)';

COMMENT ON COLUMN public.review_comments.image_url IS
'URL of attached screenshot image stored in Supabase Storage';

-- Add general_opinion field to content_reviews table for overall feedback
ALTER TABLE public.content_reviews
ADD COLUMN IF NOT EXISTS general_opinion TEXT;

COMMENT ON COLUMN public.content_reviews.general_opinion IS
'General opinion/feedback from the reviewer about the content';
