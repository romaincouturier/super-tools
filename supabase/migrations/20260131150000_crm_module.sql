-- Migration: CRM Module
-- Complete CRM system for lead management, sales pipeline, activities and reporting

-- =====================================================
-- 1. PIPELINE STAGES (Customizable per organization)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  position INT NOT NULL DEFAULT 0,
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  probability INT DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_stage_position UNIQUE (organization_id, position)
);

-- Default pipeline stages function
CREATE OR REPLACE FUNCTION setup_default_pipeline_stages(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO crm_pipeline_stages (organization_id, name, color, position, probability, is_won, is_lost) VALUES
    (p_org_id, 'Nouveau', '#94a3b8', 0, 10, FALSE, FALSE),
    (p_org_id, 'Contacté', '#3b82f6', 1, 20, FALSE, FALSE),
    (p_org_id, 'Qualification', '#8b5cf6', 2, 40, FALSE, FALSE),
    (p_org_id, 'Proposition', '#f59e0b', 3, 60, FALSE, FALSE),
    (p_org_id, 'Négociation', '#ef4444', 4, 80, FALSE, FALSE),
    (p_org_id, 'Gagné', '#22c55e', 5, 100, TRUE, FALSE),
    (p_org_id, 'Perdu', '#6b7280', 6, 0, FALSE, TRUE);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. LEADS / OPPORTUNITIES
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Contact info
  company_name TEXT,
  contact_first_name TEXT,
  contact_last_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_position TEXT,

  -- Company info
  siren TEXT,
  siret TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'France',
  website TEXT,
  linkedin_url TEXT,

  -- Lead info
  title TEXT NOT NULL, -- Opportunity title
  description TEXT,
  source TEXT, -- manual, zapier, email, linkedin, website, referral
  source_details JSONB DEFAULT '{}', -- Extra info about source

  -- Pipeline
  stage_id UUID REFERENCES crm_pipeline_stages(id),
  amount DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  expected_close_date DATE,
  actual_close_date DATE,

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),

  -- Status
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  temperature TEXT DEFAULT 'warm' CHECK (temperature IN ('cold', 'warm', 'hot')),
  tags TEXT[] DEFAULT '{}',

  -- Related training (if converted)
  training_id UUID REFERENCES trainings(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_leads_org ON crm_leads(organization_id);
CREATE INDEX idx_crm_leads_stage ON crm_leads(stage_id);
CREATE INDEX idx_crm_leads_assigned ON crm_leads(assigned_to);
CREATE INDEX idx_crm_leads_email ON crm_leads(contact_email);
CREATE INDEX idx_crm_leads_siren ON crm_leads(siren);

-- =====================================================
-- 3. ACTIVITIES (Tasks, Calls, Meetings, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,

  -- Activity type
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'meeting', 'email', 'task', 'demo', 'follow_up', 'other')),
  title TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 30,
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  outcome TEXT, -- Result of the activity

  -- Call-specific
  call_direction TEXT CHECK (call_direction IN ('inbound', 'outbound')),
  call_recording_url TEXT,

  -- AI generated questions for calls
  ai_suggested_questions JSONB DEFAULT '[]',

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),

  -- Reminder
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,

  -- Calendar sync
  calendar_event_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX idx_crm_activities_scheduled ON crm_activities(scheduled_at);
CREATE INDEX idx_crm_activities_assigned ON crm_activities(assigned_to);
CREATE INDEX idx_crm_activities_status ON crm_activities(status);

-- =====================================================
-- 4. NOTES
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_notes_lead ON crm_notes(lead_id);

-- =====================================================
-- 5. EMAIL TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,

  -- Email content
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],

  -- Template
  template_id UUID,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'bounced')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Tracking
  opened_at TIMESTAMPTZ,
  open_count INT DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INT DEFAULT 0,
  replied_at TIMESTAMPTZ,

  -- External IDs
  resend_message_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_emails_lead ON crm_emails(lead_id);
CREATE INDEX idx_crm_emails_status ON crm_emails(status);

-- =====================================================
-- 6. QUOTES (Devis)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,

  -- Quote details
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  client_siren TEXT,

  -- Items
  items JSONB DEFAULT '[]', -- Array of {description, quantity, unit_price, tax_rate}

  -- Totals
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',

  -- Validity
  valid_until DATE,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  -- Signature
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  signed_ip TEXT,

  -- PDF
  pdf_url TEXT,

  -- Converted to invoice
  invoice_id UUID,

  -- Link to micro-devis if any
  micro_devis_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_quotes_lead ON crm_quotes(lead_id);
CREATE INDEX idx_crm_quotes_status ON crm_quotes(status);

-- =====================================================
-- 7. INVOICES (Factures)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES crm_quotes(id) ON DELETE SET NULL,
  training_id UUID REFERENCES trainings(id) ON DELETE SET NULL,

  -- Invoice details
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  client_siren TEXT,

  -- Items
  items JSONB DEFAULT '[]',

  -- Totals
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',

  -- Payment
  payment_terms TEXT DEFAULT 'net_30',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  payment_method TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  sent_at TIMESTAMPTZ,

  -- PDF
  pdf_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_invoices_lead ON crm_invoices(lead_id);
CREATE INDEX idx_crm_invoices_status ON crm_invoices(status);
CREATE INDEX idx_crm_invoices_due ON crm_invoices(due_date);

-- =====================================================
-- 8. SALES OBJECTIVES
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Target
  user_id UUID REFERENCES auth.users(id), -- NULL = team objective
  target_type TEXT NOT NULL CHECK (target_type IN ('revenue', 'deals', 'calls', 'meetings')),
  target_value DECIMAL(12, 2) NOT NULL,
  current_value DECIMAL(12, 2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_objectives_org ON crm_objectives(organization_id);
CREATE INDEX idx_crm_objectives_user ON crm_objectives(user_id);
CREATE INDEX idx_crm_objectives_period ON crm_objectives(period_start, period_end);

-- =====================================================
-- 9. LEAD HISTORY (Timeline)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL, -- stage_change, note_added, email_sent, call_completed, etc.

  -- Old and new values
  old_value JSONB,
  new_value JSONB,

  -- Description
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_lead_history ON crm_lead_history(lead_id, created_at DESC);

-- =====================================================
-- 10. EMAIL TEMPLATES (for CRM)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Variables available
  available_variables JSONB DEFAULT '["contact_first_name", "contact_last_name", "company_name", "user_name"]',

  -- Category
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'follow_up', 'proposal', 'thank_you', 'cold_outreach')),

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_crm_email_templates_org ON crm_email_templates(organization_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_templates ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pipeline stages policies
CREATE POLICY "crm_pipeline_stages_select" ON crm_pipeline_stages
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_pipeline_stages_insert" ON crm_pipeline_stages
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_pipeline_stages_update" ON crm_pipeline_stages
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_pipeline_stages_delete" ON crm_pipeline_stages
  FOR DELETE USING (organization_id = get_user_org_id());

-- Leads policies
CREATE POLICY "crm_leads_select" ON crm_leads
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_leads_insert" ON crm_leads
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_leads_update" ON crm_leads
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_leads_delete" ON crm_leads
  FOR DELETE USING (organization_id = get_user_org_id());

-- Activities policies
CREATE POLICY "crm_activities_select" ON crm_activities
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_activities_insert" ON crm_activities
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_activities_update" ON crm_activities
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_activities_delete" ON crm_activities
  FOR DELETE USING (organization_id = get_user_org_id());

-- Notes policies
CREATE POLICY "crm_notes_select" ON crm_notes
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_notes_insert" ON crm_notes
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_notes_update" ON crm_notes
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_notes_delete" ON crm_notes
  FOR DELETE USING (organization_id = get_user_org_id());

-- Emails policies
CREATE POLICY "crm_emails_select" ON crm_emails
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_emails_insert" ON crm_emails
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_emails_update" ON crm_emails
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_emails_delete" ON crm_emails
  FOR DELETE USING (organization_id = get_user_org_id());

-- Quotes policies
CREATE POLICY "crm_quotes_select" ON crm_quotes
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_quotes_insert" ON crm_quotes
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_quotes_update" ON crm_quotes
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_quotes_delete" ON crm_quotes
  FOR DELETE USING (organization_id = get_user_org_id());

-- Invoices policies
CREATE POLICY "crm_invoices_select" ON crm_invoices
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_invoices_insert" ON crm_invoices
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_invoices_update" ON crm_invoices
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_invoices_delete" ON crm_invoices
  FOR DELETE USING (organization_id = get_user_org_id());

-- Objectives policies
CREATE POLICY "crm_objectives_select" ON crm_objectives
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_objectives_insert" ON crm_objectives
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_objectives_update" ON crm_objectives
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_objectives_delete" ON crm_objectives
  FOR DELETE USING (organization_id = get_user_org_id());

-- Lead history policies
CREATE POLICY "crm_lead_history_select" ON crm_lead_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM crm_leads
      WHERE crm_leads.id = crm_lead_history.lead_id
      AND crm_leads.organization_id = get_user_org_id()
    )
  );
CREATE POLICY "crm_lead_history_insert" ON crm_lead_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_leads
      WHERE crm_leads.id = crm_lead_history.lead_id
      AND crm_leads.organization_id = get_user_org_id()
    )
  );

-- Email templates policies
CREATE POLICY "crm_email_templates_select" ON crm_email_templates
  FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "crm_email_templates_insert" ON crm_email_templates
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "crm_email_templates_update" ON crm_email_templates
  FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "crm_email_templates_delete" ON crm_email_templates
  FOR DELETE USING (organization_id = get_user_org_id());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update lead last_activity_at when activity is created
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_leads
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_activity
AFTER INSERT ON crm_activities
FOR EACH ROW
EXECUTE FUNCTION update_lead_last_activity();

-- Log stage changes
CREATE OR REPLACE FUNCTION log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO crm_lead_history (lead_id, event_type, old_value, new_value, created_by)
    VALUES (
      NEW.id,
      'stage_change',
      jsonb_build_object('stage_id', OLD.stage_id),
      jsonb_build_object('stage_id', NEW.stage_id),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_stage_change
AFTER UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION log_lead_stage_change();

-- Update objectives current value (example for revenue)
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- When a lead is marked as won, update revenue objectives
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    UPDATE crm_objectives
    SET current_value = current_value + NEW.amount,
        updated_at = NOW()
    WHERE organization_id = NEW.organization_id
    AND target_type = 'revenue'
    AND period_start <= CURRENT_DATE
    AND period_end >= CURRENT_DATE
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM crm_pipeline_stages
      WHERE id = NEW.stage_id AND is_won = TRUE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_objective
AFTER UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION update_objective_progress();

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  org_slug TEXT;
  year_str TEXT;
  seq_num INT;
BEGIN
  SELECT slug INTO org_slug FROM organizations WHERE id = NEW.organization_id;
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
  ), 0) + 1 INTO seq_num
  FROM crm_invoices
  WHERE organization_id = NEW.organization_id
  AND invoice_number LIKE 'F-' || year_str || '-%';

  NEW.invoice_number := 'F-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
BEFORE INSERT ON crm_invoices
FOR EACH ROW
WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
EXECUTE FUNCTION generate_invoice_number();

-- Generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  org_slug TEXT;
  year_str TEXT;
  seq_num INT;
BEGIN
  SELECT slug INTO org_slug FROM organizations WHERE id = NEW.organization_id;
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INT)
  ), 0) + 1 INTO seq_num
  FROM crm_quotes
  WHERE organization_id = NEW.organization_id
  AND quote_number LIKE 'D-' || year_str || '-%';

  NEW.quote_number := 'D-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_quote_number
BEFORE INSERT ON crm_quotes
FOR EACH ROW
WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
EXECUTE FUNCTION generate_quote_number();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE crm_leads IS 'Main CRM leads/opportunities table';
COMMENT ON TABLE crm_pipeline_stages IS 'Customizable sales pipeline stages';
COMMENT ON TABLE crm_activities IS 'Sales activities: calls, meetings, tasks, etc.';
COMMENT ON TABLE crm_notes IS 'Notes attached to leads';
COMMENT ON TABLE crm_emails IS 'Email tracking for CRM';
COMMENT ON TABLE crm_quotes IS 'Sales quotes/devis';
COMMENT ON TABLE crm_invoices IS 'Customer invoices';
COMMENT ON TABLE crm_objectives IS 'Sales objectives and targets';
COMMENT ON TABLE crm_lead_history IS 'Timeline of lead changes';
