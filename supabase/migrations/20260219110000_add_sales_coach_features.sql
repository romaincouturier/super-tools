-- Features 1-4: Add won_at/lost_at, acquisition_source, loss_reason, revenue_targets

-- Feature 1: Historique temporel
ALTER TABLE crm_cards
ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill won_at from activity_log
UPDATE crm_cards c
SET won_at = (
  SELECT MIN(a.created_at)
  FROM crm_activity_log a
  WHERE a.card_id = c.id
    AND a.action_type = 'sales_status_changed'
    AND a.new_value = 'WON'
)
WHERE c.sales_status = 'WON' AND c.won_at IS NULL;

-- Backfill lost_at from activity_log
UPDATE crm_cards c
SET lost_at = (
  SELECT MIN(a.created_at)
  FROM crm_activity_log a
  WHERE a.card_id = c.id
    AND a.action_type = 'sales_status_changed'
    AND a.new_value = 'LOST'
)
WHERE c.sales_status = 'LOST' AND c.lost_at IS NULL;

-- Feature 2: Source d'acquisition
ALTER TABLE crm_cards
ADD COLUMN IF NOT EXISTS acquisition_source TEXT DEFAULT NULL;

-- Feature 3: Raison de perte
ALTER TABLE crm_cards
ADD COLUMN IF NOT EXISTS loss_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS loss_reason_detail TEXT DEFAULT NULL;

-- Feature 4: Objectifs CA
CREATE TABLE IF NOT EXISTS crm_revenue_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(period_type, period_start)
);

-- RLS for revenue targets
ALTER TABLE crm_revenue_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage revenue targets"
  ON crm_revenue_targets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
