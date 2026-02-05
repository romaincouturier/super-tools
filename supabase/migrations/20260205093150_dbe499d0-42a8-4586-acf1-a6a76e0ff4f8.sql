-- Add card_type column to content_cards table
ALTER TABLE public.content_cards 
ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'article';

-- Add comment for documentation
COMMENT ON COLUMN public.content_cards.card_type IS 'Type of content: article or post';