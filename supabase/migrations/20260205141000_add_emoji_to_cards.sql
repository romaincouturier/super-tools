-- Add emoji column to all card/kanban tables
ALTER TABLE content_cards ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE crm_cards ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS emoji text;
