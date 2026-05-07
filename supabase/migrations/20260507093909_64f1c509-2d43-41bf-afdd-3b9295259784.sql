ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_support_tickets_archived_at
  ON public.support_tickets(archived_at);