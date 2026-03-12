-- v0.3: Add cooling thresholds and interaction logging

-- Add configurable cooling thresholds per warmth level (in days)
-- hot contacts cool after 14 days, warm after 30, cold after 60
ALTER TABLE user_positioning
  ADD COLUMN IF NOT EXISTS cooling_thresholds JSONB DEFAULT '{"hot": 14, "warm": 30, "cold": 60}';

-- Interaction log — tracks every interaction with a contact (richer than just last_contact_date)
CREATE TABLE IF NOT EXISTS network_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES network_contacts(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_interactions_contact ON network_interactions (contact_id, created_at DESC);
CREATE INDEX idx_network_interactions_user ON network_interactions (user_id, created_at DESC);

ALTER TABLE network_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interactions"
  ON network_interactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-update last_contact_date on network_contacts when an interaction is logged
CREATE OR REPLACE FUNCTION update_contact_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE network_contacts
  SET last_contact_date = (NEW.created_at AT TIME ZONE 'UTC')::date
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_contact_last_interaction
  AFTER INSERT ON network_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_interaction();
