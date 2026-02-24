-- Scheduled emails table for CRM email scheduling
CREATE TABLE IF NOT EXISTS crm_scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  attachments JSONB DEFAULT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE crm_scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scheduled emails"
ON crm_scheduled_emails FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert scheduled emails"
ON crm_scheduled_emails FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scheduled emails"
ON crm_scheduled_emails FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete scheduled emails"
ON crm_scheduled_emails FOR DELETE USING (auth.uid() IS NOT NULL);

-- Index for cron job to find pending emails
CREATE INDEX idx_crm_scheduled_emails_pending ON crm_scheduled_emails(scheduled_at) WHERE status = 'pending';
