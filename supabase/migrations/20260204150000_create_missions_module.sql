-- Create missions module tables

-- Mission status enum
CREATE TYPE mission_status AS ENUM ('not_started', 'in_progress', 'completed', 'cancelled');

-- Missions table (Notion-style Kanban)
CREATE TABLE IF NOT EXISTS missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_contact TEXT,
  status mission_status DEFAULT 'not_started',
  start_date DATE,
  end_date DATE,
  daily_rate DECIMAL(10, 2),
  total_days INTEGER,
  total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (daily_rate * total_days) STORED,
  tags TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#6b7280',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- RLS policies for missions
CREATE POLICY "Users can view all missions" ON missions
  FOR SELECT USING (true);

CREATE POLICY "Users can create missions" ON missions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update missions" ON missions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete missions" ON missions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Index for faster queries
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_created_at ON missions(created_at DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_missions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION update_missions_updated_at();

-- Link table for CRM cards referencing missions
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS linked_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;
