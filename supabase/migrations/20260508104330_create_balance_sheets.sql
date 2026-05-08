-- Use case 5 BalanceSheetAnalyzer : bucket pour stocker les PDF de
-- bilans uploadés par l'utilisateur, et table de stockage des données
-- extraites en JSON par l'IA.

-- ── Storage bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'balance-sheets',
  'balance-sheets',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "balance_sheets_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'balance-sheets' AND (
      EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
      )
    )
  );

CREATE POLICY "balance_sheets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'balance-sheets' AND
    (storage.foldername(name))[1] = auth.uid()::text AND (
      EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
      OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
    )
  );

CREATE POLICY "balance_sheets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'balance-sheets' AND (
      EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
      )
    )
  );

-- ── Table balance_sheets ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee INTEGER NOT NULL CHECK (annee BETWEEN 2000 AND 2100),
  data JSONB NOT NULL,
  pdf_filename TEXT,
  pdf_storage_path TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balance_sheets_user_annee_unique UNIQUE (user_id, annee)
);

CREATE INDEX idx_balance_sheets_user_annee ON balance_sheets(user_id, annee DESC);

ALTER TABLE balance_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_sheets_table_select" ON balance_sheets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "balance_sheets_table_insert" ON balance_sheets FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
    OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "balance_sheets_table_update" ON balance_sheets FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE POLICY "balance_sheets_table_delete" ON balance_sheets FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'finances')
  )
);

CREATE TRIGGER balance_sheets_updated_at
BEFORE UPDATE ON balance_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
