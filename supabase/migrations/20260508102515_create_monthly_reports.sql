-- Use case 4 MonthlyReport : snapshot mensuel agrégeant Pennylane
-- (P&L, factures) et CRM (deals gagnés / pipeline). Génération
-- on-demand par l'edge function generate-monthly-report.

CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_user_month_unique UNIQUE (user_id, month)
);

CREATE INDEX idx_monthly_reports_user_month ON monthly_reports(user_id, month DESC);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reports_select" ON monthly_reports FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "monthly_reports_insert" ON monthly_reports FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
    OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "monthly_reports_update" ON monthly_reports FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "monthly_reports_delete" ON monthly_reports FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);
