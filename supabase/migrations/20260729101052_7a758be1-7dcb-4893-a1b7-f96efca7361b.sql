ALTER TABLE public.crm_card_emails
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS crm_card_emails_resend_email_id_idx
  ON public.crm_card_emails (resend_email_id);