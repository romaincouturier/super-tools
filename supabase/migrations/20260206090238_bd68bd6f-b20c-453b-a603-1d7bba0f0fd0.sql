
-- Add proof_hash and journey_events columns to devis_signatures
ALTER TABLE public.devis_signatures
  ADD COLUMN IF NOT EXISTS proof_file_url text,
  ADD COLUMN IF NOT EXISTS proof_hash text,
  ADD COLUMN IF NOT EXISTS journey_events jsonb;

-- Add proof_hash and journey_events columns to attendance_signatures
ALTER TABLE public.attendance_signatures
  ADD COLUMN IF NOT EXISTS proof_file_url text,
  ADD COLUMN IF NOT EXISTS proof_hash text,
  ADD COLUMN IF NOT EXISTS journey_events jsonb;
