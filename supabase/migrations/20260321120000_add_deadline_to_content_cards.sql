-- Add optional deadline column to content_cards
ALTER TABLE public.content_cards
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- Index for querying cards by deadline
CREATE INDEX IF NOT EXISTS idx_content_cards_deadline
  ON public.content_cards (deadline)
  WHERE deadline IS NOT NULL;
