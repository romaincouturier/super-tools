-- Add emoji column to content_cards table
ALTER TABLE public.content_cards
ADD COLUMN IF NOT EXISTS emoji TEXT;