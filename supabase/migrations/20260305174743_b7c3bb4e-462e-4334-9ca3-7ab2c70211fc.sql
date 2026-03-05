
-- Table to log all sent emails for Qualiopi traceability
CREATE TABLE public.sent_emails_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  email_type TEXT,
  training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast participant lookups
CREATE INDEX idx_sent_emails_log_participant ON public.sent_emails_log(participant_id);
CREATE INDEX idx_sent_emails_log_recipient ON public.sent_emails_log(recipient_email);
CREATE INDEX idx_sent_emails_log_training ON public.sent_emails_log(training_id);

-- RLS
ALTER TABLE public.sent_emails_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sent emails"
  ON public.sent_emails_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert sent emails"
  ON public.sent_emails_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
