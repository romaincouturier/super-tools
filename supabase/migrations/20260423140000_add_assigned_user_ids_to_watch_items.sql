-- ============================================================
-- Tag users on watch items
-- ============================================================
-- Allows multiple users to be tagged ("watchers") on a single
-- watch_items row. When a user id is added to the array, an
-- edge function sends them an email notification.

ALTER TABLE public.watch_items
  ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_watch_items_assigned_user_ids
  ON public.watch_items USING GIN (assigned_user_ids);
