-- Add all missing columns to crm_cards table
-- This migration consolidates all missing columns in one place

-- Next action fields
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS next_action_text TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS next_action_done BOOLEAN DEFAULT FALSE;

-- Website URL field
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Linked mission field (without foreign key for now, will be added when missions table exists)
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS linked_mission_id UUID;

-- Add foreign key to missions if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'missions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_crm_cards_linked_mission'
      AND table_name = 'crm_cards'
    ) THEN
      ALTER TABLE crm_cards
      ADD CONSTRAINT fk_crm_cards_linked_mission
      FOREIGN KEY (linked_mission_id)
      REFERENCES missions(id)
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
