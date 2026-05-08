-- Use case 2 CashFlowBudget : table de lignes prévisionnelles de
-- trésorerie (budget mensuel). Chaque ligne appartient à un user et
-- peut être saisie manuellement, importée depuis le pipeline CRM,
-- ou détectée comme charge récurrente depuis Pennylane.

CREATE TABLE IF NOT EXISTS cashflow_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'crm_deal', 'recurring_detected')),
  source_ref UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cashflow_forecast_user_month ON cashflow_forecast(user_id, month);
CREATE INDEX idx_cashflow_forecast_source_ref ON cashflow_forecast(source, source_ref) WHERE source_ref IS NOT NULL;

ALTER TABLE cashflow_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashflow_forecast_select" ON cashflow_forecast FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "cashflow_forecast_insert" ON cashflow_forecast FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
    OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "cashflow_forecast_update" ON cashflow_forecast FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "cashflow_forecast_delete" ON cashflow_forecast FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE TRIGGER cashflow_forecast_updated_at
BEFORE UPDATE ON cashflow_forecast
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
