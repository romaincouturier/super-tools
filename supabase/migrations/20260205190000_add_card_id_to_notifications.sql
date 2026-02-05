-- Add card_id column to content_notifications for direct card navigation
ALTER TABLE public.content_notifications
  ADD COLUMN IF NOT EXISTS card_id UUID;
