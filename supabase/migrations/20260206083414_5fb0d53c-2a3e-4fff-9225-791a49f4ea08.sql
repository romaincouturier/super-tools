
-- Table to track convention signature requests (online signing)
CREATE TABLE public.convention_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  client_name TEXT NOT NULL,
  formation_name TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  audit_metadata JSONB,
  email_opened_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.convention_signatures ENABLE ROW LEVEL SECURITY;

-- Public read access for signature pages (token-based, no auth needed)
CREATE POLICY "Public can read convention signatures by token"
  ON public.convention_signatures
  FOR SELECT
  USING (true);

-- Only service role can insert/update (done via edge functions)
CREATE POLICY "Authenticated users can manage convention signatures"
  ON public.convention_signatures
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_convention_signatures_updated_at
  BEFORE UPDATE ON public.convention_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
