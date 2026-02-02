-- ============================================
-- INTEGRATIONS SETTINGS FOR SUPERTOOLS
-- ============================================
-- Configurable external integrations per organization

-- ============================================
-- 1. INTEGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- PDF Generation
  pdf_provider TEXT NOT NULL DEFAULT 'internal', -- 'internal' or 'pdfmonkey'
  pdfmonkey_api_key TEXT,
  pdfmonkey_template_id TEXT,

  -- Google Drive
  google_drive_enabled BOOLEAN DEFAULT false,
  google_drive_client_id TEXT,
  google_drive_client_secret TEXT,
  google_drive_refresh_token TEXT,
  google_drive_folder_id TEXT,

  -- Email Provider (Resend)
  resend_api_key TEXT,
  resend_from_email TEXT,
  resend_from_name TEXT,

  -- Signitic (email signatures)
  signitic_enabled BOOLEAN DEFAULT false,
  signitic_api_key TEXT,
  signitic_user_email TEXT,

  -- AI Provider (Gemini)
  gemini_enabled BOOLEAN DEFAULT false,
  gemini_api_key TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id)
);

-- ============================================
-- 2. RLS POLICIES
-- ============================================
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view integrations
CREATE POLICY "Admins can view org integrations"
  ON integrations FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Only admins/owners can manage integrations
CREATE POLICY "Admins can manage org integrations"
  ON integrations FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- 3. INDEX
-- ============================================
CREATE INDEX IF NOT EXISTS idx_integrations_organization ON integrations(organization_id);

-- ============================================
-- 4. CREATE DEFAULT INTEGRATIONS ON ORG SETUP
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_integrations(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO integrations (organization_id, pdf_provider)
  VALUES (p_org_id, 'internal')
  ON CONFLICT (organization_id) DO NOTHING;
END;
$$;

-- Update setup_new_organization to include integrations
CREATE OR REPLACE FUNCTION public.setup_new_organization(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_owner_id UUID,
  p_owner_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug)
  VALUES (p_org_name, p_org_slug)
  RETURNING id INTO v_org_id;

  -- Create subscription (free tier)
  INSERT INTO subscriptions (organization_id, plan, status, monthly_training_limit)
  VALUES (v_org_id, 'free', 'active', 2);

  -- Create/update user profile as owner
  INSERT INTO user_profiles (id, organization_id, email, role)
  VALUES (p_owner_id, v_org_id, p_owner_email, 'owner')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = v_org_id,
    role = 'owner',
    updated_at = now();

  -- Create default trainer
  INSERT INTO trainers (organization_id, user_id, name, email, is_default)
  VALUES (v_org_id, p_owner_id, split_part(p_owner_email, '@', 1), p_owner_email, true);

  -- Create default email templates
  PERFORM create_default_email_templates(v_org_id);

  -- Create default integrations
  PERFORM create_default_integrations(v_org_id);

  RETURN v_org_id;
END;
$$;

-- ============================================
-- 5. COMMENTS
-- ============================================
COMMENT ON TABLE integrations IS 'External integrations configuration per organization';
COMMENT ON COLUMN integrations.pdf_provider IS 'PDF generation: internal (jsPDF) or pdfmonkey';
COMMENT ON COLUMN integrations.google_drive_enabled IS 'Enable Google Drive certificate storage';
