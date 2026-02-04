-- Table for storing inbound emails received via Resend
CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email metadata
  message_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  cc TEXT[],
  bcc TEXT[],
  reply_to TEXT,

  -- Content
  subject TEXT,
  text_body TEXT,
  html_body TEXT,

  -- Attachments stored as JSON array
  attachments JSONB DEFAULT '[]',

  -- Headers (useful for debugging)
  headers JSONB DEFAULT '{}',

  -- Processing status
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'archived', 'spam')),
  processed_at TIMESTAMPTZ,

  -- Linked entities (if email relates to a training, participant, etc.)
  linked_training_id UUID REFERENCES trainings(id) ON DELETE SET NULL,
  linked_participant_id UUID REFERENCES training_participants(id) ON DELETE SET NULL,

  -- Notes from user
  notes TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for searching
CREATE INDEX idx_inbound_emails_from ON inbound_emails(from_email);
CREATE INDEX idx_inbound_emails_to ON inbound_emails(to_email);
CREATE INDEX idx_inbound_emails_status ON inbound_emails(status);
CREATE INDEX idx_inbound_emails_received ON inbound_emails(received_at DESC);
CREATE INDEX idx_inbound_emails_subject ON inbound_emails USING GIN (to_tsvector('french', subject));

-- Enable RLS
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view emails
CREATE POLICY "Inbound emails viewable by authenticated users"
  ON inbound_emails FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Inbound emails manageable by admins"
  ON inbound_emails FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
    )
  );

-- Allow service role to insert (for webhook)
CREATE POLICY "Service role can insert inbound emails"
  ON inbound_emails FOR INSERT
  TO service_role
  WITH CHECK (true);
