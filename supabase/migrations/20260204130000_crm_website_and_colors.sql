-- Add website_url column to crm_cards
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Create CRM settings table for colors and other configurations
CREATE TABLE IF NOT EXISTS crm_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default color settings for service types
INSERT INTO crm_settings (setting_key, setting_value)
VALUES (
  'service_type_colors',
  '{"formation": "#3b82f6", "mission": "#8b5cf6", "default": "#6b7280"}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS on crm_settings
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for crm_settings (read for authenticated users)
CREATE POLICY "Authenticated users can read CRM settings"
  ON crm_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Create RLS policy for crm_settings (update for CRM users)
CREATE POLICY "CRM users can update CRM settings"
  ON crm_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.has_crm_access(auth.uid())
  );

-- Create RLS policy for crm_settings (insert for CRM users)
CREATE POLICY "CRM users can insert CRM settings"
  ON crm_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_crm_access(auth.uid())
  );
