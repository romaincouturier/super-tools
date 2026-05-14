ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS invoice_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_items_pending_invoice
  ON public.order_items (game_id)
  WHERE email_sent_at IS NOT NULL AND invoice_received_at IS NULL;