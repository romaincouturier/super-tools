
-- Add card_id to review_comments for direct card-level comments (without needing a review)
ALTER TABLE public.review_comments
  ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.content_cards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Make review_id nullable so comments can exist without a review
ALTER TABLE public.review_comments
  ALTER COLUMN review_id DROP NOT NULL;

-- Backfill card_id from existing review_comments via content_reviews
UPDATE public.review_comments rc
SET card_id = cr.card_id
FROM public.content_reviews cr
WHERE rc.review_id = cr.id AND rc.card_id IS NULL;

-- Index for fast lookups by card_id
CREATE INDEX IF NOT EXISTS idx_review_comments_card_id ON public.review_comments(card_id);
