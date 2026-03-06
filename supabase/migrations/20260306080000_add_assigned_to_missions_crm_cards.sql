-- Add assigned_to column to missions and crm_cards tables
-- Allows filtering alerts/notifications per user assignment

ALTER TABLE missions
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

ALTER TABLE crm_cards
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Default assigned_to to the creator (auth.uid()) on INSERT when not explicitly set
CREATE OR REPLACE FUNCTION set_default_assigned_to()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER missions_default_assigned_to
  BEFORE INSERT ON missions
  FOR EACH ROW
  EXECUTE FUNCTION set_default_assigned_to();

CREATE TRIGGER crm_cards_default_assigned_to
  BEFORE INSERT ON crm_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_default_assigned_to();

-- Backfill existing missions: assign to created_by where available
UPDATE missions SET assigned_to = created_by WHERE assigned_to IS NULL AND created_by IS NOT NULL;

-- Add assigned_to to events table for CFP/event assignment
ALTER TABLE events
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE TRIGGER events_default_assigned_to
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_default_assigned_to();
