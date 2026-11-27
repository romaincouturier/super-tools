CREATE TABLE IF NOT EXISTS public.elementor_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  submission jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','error')),
  error_message text,
  card_id uuid,
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS elementor_webhook_inbox_status_idx ON public.elementor_webhook_inbox (status, received_at);
GRANT SELECT ON public.elementor_webhook_inbox TO authenticated;
GRANT ALL ON public.elementor_webhook_inbox TO service_role;
ALTER TABLE public.elementor_webhook_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read elementor inbox" ON public.elementor_webhook_inbox;
CREATE POLICY "Admins read elementor inbox" ON public.elementor_webhook_inbox
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));