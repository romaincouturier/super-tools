-- Add audit_metadata column to attendance_signatures for legal compliance
-- This stores additional audit information required for French eIDAS compliance:
-- - Consent text and timestamp
-- - Signature hash for integrity verification
-- - Device information
-- - Legal references

ALTER TABLE public.attendance_signatures
ADD COLUMN IF NOT EXISTS audit_metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.attendance_signatures.audit_metadata IS
'JSON object containing audit trail data for legal compliance (eIDAS, Code Civil art. 1366-1367). Includes: consent_given, consent_timestamp, consent_text, device_info, signature_hash, legal_reference.';

-- Create index on audit_metadata for potential queries
CREATE INDEX IF NOT EXISTS idx_attendance_signatures_audit ON public.attendance_signatures USING gin(audit_metadata);
