-- Add confidence_score to CRM cards (0-100 scale, NULL = not set)
ALTER TABLE crm_cards
ADD COLUMN IF NOT EXISTS confidence_score smallint DEFAULT NULL
CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

-- Comment for clarity
COMMENT ON COLUMN crm_cards.confidence_score IS 'Confidence score (0-100) indicating how likely this opportunity is to close';
