-- Add next action fields to crm_cards
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS next_action_text TEXT;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS next_action_done BOOLEAN DEFAULT FALSE;
