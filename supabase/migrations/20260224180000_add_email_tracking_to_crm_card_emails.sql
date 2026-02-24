-- Add email tracking columns to crm_card_emails
-- Tracks delivery, opens and clicks via Resend webhooks

ALTER TABLE crm_card_emails
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_card_emails_resend_id ON crm_card_emails(resend_email_id);

COMMENT ON COLUMN crm_card_emails.resend_email_id IS 'Resend email ID for webhook matching';
COMMENT ON COLUMN crm_card_emails.delivery_status IS 'Email delivery status: sent, delivered, bounced, complained';
COMMENT ON COLUMN crm_card_emails.opened_at IS 'First open timestamp (tracking pixel)';
COMMENT ON COLUMN crm_card_emails.open_count IS 'Total number of opens';
COMMENT ON COLUMN crm_card_emails.clicked_at IS 'First click timestamp';
COMMENT ON COLUMN crm_card_emails.click_count IS 'Total number of link clicks';

-- Allow service role to update tracking data
CREATE POLICY "crm_card_emails_update_service" ON crm_card_emails
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
