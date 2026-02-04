-- Add linked_mission_id column to crm_cards
-- This allows linking a CRM opportunity to a mission

ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS linked_mission_id UUID;

-- Add foreign key constraint if missions table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'missions') THEN
    ALTER TABLE crm_cards
    ADD CONSTRAINT fk_crm_cards_linked_mission
    FOREIGN KEY (linked_mission_id)
    REFERENCES missions(id)
    ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
