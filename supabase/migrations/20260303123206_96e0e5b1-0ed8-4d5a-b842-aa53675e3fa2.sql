
CREATE TABLE public.event_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  shared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, recipient_email)
);

ALTER TABLE public.event_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event_shares"
  ON public.event_shares FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert event_shares"
  ON public.event_shares FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete event_shares"
  ON public.event_shares FOR DELETE TO authenticated USING (true);
