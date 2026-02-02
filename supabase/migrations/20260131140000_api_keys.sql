-- Migration: API Keys for external integrations (Zapier, etc.)
-- This migration creates a table for storing API keys used by external services

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars of key for identification (e.g., "sk_live_abc")
  permissions JSONB DEFAULT '["trainings:read", "trainings:write", "participants:read", "participants:write"]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT api_keys_name_org_unique UNIQUE (organization_id, name)
);

-- Create index for faster lookups
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Only org admins/owners can view API keys
CREATE POLICY "api_keys_select_policy" ON api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = api_keys.organization_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Only org admins/owners can insert API keys
CREATE POLICY "api_keys_insert_policy" ON api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = api_keys.organization_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Only org admins/owners can update API keys
CREATE POLICY "api_keys_update_policy" ON api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = api_keys.organization_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Only org admins/owners can delete API keys
CREATE POLICY "api_keys_delete_policy" ON api_keys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = api_keys.organization_id
      AND user_profiles.role IN ('owner', 'admin')
    )
  );

-- Add Zapier to integrations table if it exists
INSERT INTO integrations (
  organization_id,
  service_name,
  is_enabled,
  config
)
SELECT
  id as organization_id,
  'zapier' as service_name,
  FALSE as is_enabled,
  '{}'::jsonb as config
FROM organizations
ON CONFLICT DO NOTHING;

-- Comment on table
COMMENT ON TABLE api_keys IS 'API keys for external service integrations (Zapier, Make, etc.)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key for secure storage';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of the key for identification in UI';
COMMENT ON COLUMN api_keys.permissions IS 'JSON array of permitted actions';
