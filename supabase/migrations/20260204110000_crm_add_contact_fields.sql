-- Add contact fields to crm_cards for AI extraction
-- Remove "Nouveau" column as cards will be created via "Nouvelle opportunité" button

-- Add new columns to crm_cards
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS service_type TEXT CHECK (service_type IS NULL OR service_type IN ('formation', 'mission'));
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS brief_questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS raw_input TEXT;

-- Create index on company for search
CREATE INDEX IF NOT EXISTS idx_crm_cards_company ON crm_cards(company) WHERE company IS NOT NULL;

-- Delete "Nouveau" column (cascade will delete any cards in it)
DELETE FROM crm_columns WHERE name = 'Nouveau';

-- Update positions of remaining columns
UPDATE crm_columns SET position = position - 1 WHERE position > 0;
