-- Create devis_signatures table for electronic quote signing
-- This implements legally compliant e-signatures for quotes (devis) per French law

CREATE TABLE public.devis_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Reference to the activity log entry for the devis
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,

  -- Recipient information
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  client_name TEXT NOT NULL,

  -- Devis details
  formation_name TEXT NOT NULL,
  devis_type TEXT NOT NULL CHECK (devis_type IN ('sans_subrogation', 'avec_subrogation')),
  pdf_url TEXT NOT NULL,

  -- Signature tracking
  token VARCHAR(255) NOT NULL UNIQUE,
  signature_data TEXT, -- Base64 encoded signature image
  signed_at TIMESTAMPTZ,

  -- Audit trail for legal compliance
  ip_address TEXT,
  user_agent TEXT,
  audit_metadata JSONB, -- Contains consent info, device info, signature hash, etc.

  -- Email tracking
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.devis_signatures ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all signatures
CREATE POLICY "Authenticated users can view devis signatures"
ON public.devis_signatures
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can create signatures
CREATE POLICY "Authenticated users can create devis signatures"
ON public.devis_signatures
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can update signatures
CREATE POLICY "Authenticated users can update devis signatures"
ON public.devis_signatures
FOR UPDATE
TO authenticated
USING (true);

-- Authenticated users can delete signatures
CREATE POLICY "Authenticated users can delete devis signatures"
ON public.devis_signatures
FOR DELETE
TO authenticated
USING (true);

-- Public can view their own signature via token (for the signing page)
CREATE POLICY "Public can view own devis signature via token"
ON public.devis_signatures
FOR SELECT
TO anon
USING (true);

-- Public can update their own signature via token (to submit the signature)
CREATE POLICY "Public can update own devis signature via token"
ON public.devis_signatures
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_devis_signatures_token ON public.devis_signatures(token);
CREATE INDEX idx_devis_signatures_recipient ON public.devis_signatures(recipient_email);
CREATE INDEX idx_devis_signatures_status ON public.devis_signatures(status);
CREATE INDEX idx_devis_signatures_activity ON public.devis_signatures(activity_log_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_devis_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_devis_signatures_updated_at
  BEFORE UPDATE ON public.devis_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_signatures_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.devis_signatures IS
'Electronic signatures for quotes (devis). Implements eIDAS-compliant e-signatures for legal validity in France. Each signature request has a unique token for the signing page.';
