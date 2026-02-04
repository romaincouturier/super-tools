-- CRM Kanban Module Migration
-- Creates tables for columns, cards, tags, attachments, comments, emails, activity log
-- Note: The 'crm' enum value is added in a separate prior migration (20260204095900_add_crm_enum.sql)

-- CRM Columns (Kanban columns)
CREATE TABLE IF NOT EXISTS crm_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_columns_position ON crm_columns(position) WHERE NOT is_archived;

-- CRM Tags
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_tags_category ON crm_tags(category);

-- CRM Cards (Opportunities)
CREATE TABLE IF NOT EXISTS crm_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES crm_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_html TEXT,
  status_operational TEXT NOT NULL DEFAULT 'TODAY' CHECK (status_operational IN ('TODAY', 'WAITING')),
  waiting_next_action_date DATE,
  waiting_next_action_text TEXT,
  sales_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (sales_status IN ('OPEN', 'WON', 'LOST', 'CANCELED')),
  estimated_value NUMERIC(12, 2) DEFAULT 0,
  quote_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint: if WAITING, date and text are required
  CONSTRAINT waiting_fields_required CHECK (
    status_operational != 'WAITING' OR (waiting_next_action_date IS NOT NULL AND waiting_next_action_text IS NOT NULL)
  )
);

CREATE INDEX idx_crm_cards_column ON crm_cards(column_id);
CREATE INDEX idx_crm_cards_position ON crm_cards(column_id, position);
CREATE INDEX idx_crm_cards_sales_status ON crm_cards(sales_status);

-- Card-Tag association
CREATE TABLE IF NOT EXISTS crm_card_tags (
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, tag_id)
);

-- CRM Attachments
CREATE TABLE IF NOT EXISTS crm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_attachments_card ON crm_attachments(card_id);

-- CRM Comments
CREATE TABLE IF NOT EXISTS crm_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_comments_card ON crm_comments(card_id) WHERE NOT is_deleted;

-- CRM Card Emails (mock sent emails)
CREATE TABLE IF NOT EXISTS crm_card_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_card_emails_card ON crm_card_emails(card_id);

-- CRM Activity Log
CREATE TABLE IF NOT EXISTS crm_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  actor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_activity_log_card ON crm_activity_log(card_id);
CREATE INDEX idx_crm_activity_log_created ON crm_activity_log(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE crm_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_card_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin (romain@supertilt.fr) has full access
-- For simplicity, using authenticated users with module access check

-- Columns policies
CREATE POLICY "crm_columns_select" ON crm_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_columns_insert" ON crm_columns FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_columns_update" ON crm_columns FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_columns_delete" ON crm_columns FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Tags policies
CREATE POLICY "crm_tags_select" ON crm_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_tags_insert" ON crm_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_tags_update" ON crm_tags FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_tags_delete" ON crm_tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Cards policies
CREATE POLICY "crm_cards_select" ON crm_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_cards_insert" ON crm_cards FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_cards_update" ON crm_cards FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_cards_delete" ON crm_cards FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Card tags policies
CREATE POLICY "crm_card_tags_select" ON crm_card_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_card_tags_insert" ON crm_card_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_card_tags_delete" ON crm_card_tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Attachments policies
CREATE POLICY "crm_attachments_select" ON crm_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_attachments_insert" ON crm_attachments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_attachments_delete" ON crm_attachments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Comments policies
CREATE POLICY "crm_comments_select" ON crm_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_comments_insert" ON crm_comments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);
CREATE POLICY "crm_comments_update" ON crm_comments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Card emails policies
CREATE POLICY "crm_card_emails_select" ON crm_card_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_card_emails_insert" ON crm_card_emails FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Activity log policies
CREATE POLICY "crm_activity_log_select" ON crm_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_activity_log_insert" ON crm_activity_log FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
);

-- Trigger for updated_at on crm_columns
CREATE OR REPLACE FUNCTION update_crm_columns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_columns_updated_at
  BEFORE UPDATE ON crm_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_columns_updated_at();

-- Trigger for updated_at on crm_cards
CREATE OR REPLACE FUNCTION update_crm_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_cards_updated_at
  BEFORE UPDATE ON crm_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_cards_updated_at();

-- Seed default columns for the CRM Pipeline
INSERT INTO crm_columns (name, position) VALUES
  ('Nouveau', 0),
  ('Qualification', 1),
  ('Proposition', 2),
  ('Négociation', 3),
  ('Gagné', 4),
  ('Perdu', 5)
ON CONFLICT DO NOTHING;

-- Seed default tags
INSERT INTO crm_tags (name, color, category) VALUES
  ('Prioritaire', '#ef4444', 'Priorité'),
  ('Normal', '#3b82f6', 'Priorité'),
  ('Faible', '#6b7280', 'Priorité'),
  ('Formation', '#8b5cf6', 'Type'),
  ('Coaching', '#10b981', 'Type'),
  ('Conseil', '#f59e0b', 'Type'),
  ('PME', '#06b6d4', 'Taille'),
  ('ETI', '#ec4899', 'Taille'),
  ('Grand compte', '#84cc16', 'Taille')
ON CONFLICT DO NOTHING;
