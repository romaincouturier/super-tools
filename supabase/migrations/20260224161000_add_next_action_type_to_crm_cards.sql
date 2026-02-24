-- Add next_action_type to distinguish between contact methods
ALTER TABLE crm_cards
  ADD COLUMN IF NOT EXISTS next_action_type TEXT DEFAULT 'other';

COMMENT ON COLUMN crm_cards.next_action_type IS 'Type of next action: email, phone, or other';
