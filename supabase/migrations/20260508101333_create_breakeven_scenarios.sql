-- Use case 3 BreakEvenSimulator : table de scénarios de point mort
-- par utilisateur. Chaque user voit/modifie uniquement ses propres
-- scénarios (l'admin voit tout via le bypass email).

CREATE TABLE IF NOT EXISTS breakeven_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fixed_costs NUMERIC(12, 2) NOT NULL DEFAULT 0,
  variable_cost_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  avg_unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_units NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT breakeven_variable_rate_range CHECK (variable_cost_rate >= 0 AND variable_cost_rate <= 1)
);

CREATE INDEX idx_breakeven_scenarios_user ON breakeven_scenarios(user_id);

ALTER TABLE breakeven_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breakeven_scenarios_select" ON breakeven_scenarios FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "breakeven_scenarios_insert" ON breakeven_scenarios FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
    OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "breakeven_scenarios_update" ON breakeven_scenarios FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "breakeven_scenarios_delete" ON breakeven_scenarios FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE TRIGGER breakeven_scenarios_updated_at
BEFORE UPDATE ON breakeven_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
