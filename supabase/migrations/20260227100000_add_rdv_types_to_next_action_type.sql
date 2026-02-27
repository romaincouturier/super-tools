-- Update comment to reflect new next_action_type values: rdv_physique and rdv_visio
COMMENT ON COLUMN crm_cards.next_action_type IS 'Type of next action: email, phone, rdv_physique, rdv_visio, or other';
