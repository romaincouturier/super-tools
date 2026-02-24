-- Add attachment_names column to crm_card_emails to track sent attachments
ALTER TABLE crm_card_emails
  ADD COLUMN IF NOT EXISTS attachment_names TEXT[] DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN crm_card_emails.attachment_names IS 'Array of filenames of attachments sent with this email';
