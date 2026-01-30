-- Create attendance_signatures table for electronic attendance tracking
CREATE TABLE public.attendance_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('AM', 'PM')),
  token VARCHAR(255) NOT NULL UNIQUE,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(training_id, participant_id, schedule_date, period)
);

-- Enable Row Level Security
ALTER TABLE public.attendance_signatures ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all signatures
CREATE POLICY "Authenticated users can view signatures"
ON public.attendance_signatures
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can create signatures
CREATE POLICY "Authenticated users can create signatures"
ON public.attendance_signatures
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can update signatures
CREATE POLICY "Authenticated users can update signatures"
ON public.attendance_signatures
FOR UPDATE
TO authenticated
USING (true);

-- Authenticated users can delete signatures
CREATE POLICY "Authenticated users can delete signatures"
ON public.attendance_signatures
FOR DELETE
TO authenticated
USING (true);

-- Public can view their own signature via token (for the signing page)
CREATE POLICY "Public can view own signature via token"
ON public.attendance_signatures
FOR SELECT
TO anon
USING (true);

-- Public can update their own signature via token (to submit the signature)
CREATE POLICY "Public can update own signature via token"
ON public.attendance_signatures
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Create index for faster token lookups
CREATE INDEX idx_attendance_signatures_token ON public.attendance_signatures(token);

-- Create index for training/date queries
CREATE INDEX idx_attendance_signatures_training_date ON public.attendance_signatures(training_id, schedule_date);