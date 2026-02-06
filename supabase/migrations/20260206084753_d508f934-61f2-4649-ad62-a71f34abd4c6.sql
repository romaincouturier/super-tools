
-- Add columns for enhanced audit trail
ALTER TABLE public.convention_signatures 
  ADD COLUMN IF NOT EXISTS pdf_hash TEXT,
  ADD COLUMN IF NOT EXISTS proof_file_url TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.convention_signatures.pdf_hash IS 'SHA-256 hash of the PDF document at time of signature creation';
COMMENT ON COLUMN public.convention_signatures.proof_file_url IS 'URL of the JSON proof file stored in Supabase Storage';
COMMENT ON COLUMN public.convention_signatures.confirmation_email_sent_at IS 'When the post-signature confirmation email was sent';
