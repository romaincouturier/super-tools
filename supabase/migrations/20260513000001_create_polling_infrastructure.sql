-- Polling cursors: tracks sync state for each external data source.
-- Edge functions use the service role key to mutate these rows.
-- Authenticated users can read status for display in settings/monitoring.

CREATE TABLE public.polling_cursors (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source        TEXT        NOT NULL UNIQUE
                            CHECK (source IN ('drive_transcripts', 'drive_testimonials', 'fireflies', 'woocommerce')),
  last_synced_at TIMESTAMPTZ,
  cursor        TEXT,        -- Drive pageToken | Fireflies cursor | WC last order id
  status        TEXT        NOT NULL DEFAULT 'idle'
                            CHECK (status IN ('idle', 'running', 'error')),
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.polling_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view polling cursors"
  ON public.polling_cursors FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER polling_cursors_updated_at
  BEFORE UPDATE ON public.polling_cursors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed one row per source so edge functions can always UPDATE (never INSERT).
INSERT INTO public.polling_cursors (source) VALUES
  ('drive_transcripts'),
  ('drive_testimonials'),
  ('fireflies'),
  ('woocommerce');
