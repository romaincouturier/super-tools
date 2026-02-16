-- Add notes column to trainings table
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add failed_emails table for email error tracking
CREATE TABLE IF NOT EXISTS public.failed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  error_message TEXT,
  email_type TEXT,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'failed' CHECK (status IN ('failed', 'retried', 'sent')),
  original_sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for failed_emails
ALTER TABLE public.failed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view failed emails"
  ON public.failed_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update failed emails"
  ON public.failed_emails FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert failed emails"
  ON public.failed_emails FOR INSERT
  TO authenticated
  USING (true);

-- Add convention follow-up settings defaults
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('delay_convention_reminder_1_days', '3', 'Délai en jours ouvrés pour la 1ère relance convention de formation')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('delay_convention_reminder_2_days', '7', 'Délai en jours ouvrés pour la 2ème relance convention de formation')
ON CONFLICT (setting_key) DO NOTHING;

-- Index for faster failed email queries
CREATE INDEX IF NOT EXISTS idx_failed_emails_status ON public.failed_emails(status);
CREATE INDEX IF NOT EXISTS idx_failed_emails_training ON public.failed_emails(training_id);
