-- API Keys table for external integrations (Zapier, etc.)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  permissions TEXT[] DEFAULT ARRAY['trainings:create'],
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Index for fast key lookup
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- API request logs for monitoring
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics
CREATE INDEX idx_api_logs_key ON api_request_logs(api_key_id);
CREATE INDEX idx_api_logs_created ON api_request_logs(created_at);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "API keys manageable by admins"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
    )
  );

-- Admins can view API logs
CREATE POLICY "API logs viewable by admins"
  ON api_request_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
    )
  );

-- Function to update last_used_at
CREATE OR REPLACE FUNCTION update_api_key_last_used(key_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE api_keys SET last_used_at = now() WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
