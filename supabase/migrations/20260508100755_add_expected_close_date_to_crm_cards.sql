-- Ajoute expected_close_date sur crm_cards pour la prévision de trésorerie
-- (use case CashFlowBudget). won_at / lost_at existent déjà pour le closing réalisé.
-- Nullable, pas de default, pas de backfill.

ALTER TABLE crm_cards
  ADD COLUMN IF NOT EXISTS expected_close_date DATE;

CREATE INDEX IF NOT EXISTS idx_crm_cards_expected_close_date
  ON crm_cards(expected_close_date)
  WHERE expected_close_date IS NOT NULL;
