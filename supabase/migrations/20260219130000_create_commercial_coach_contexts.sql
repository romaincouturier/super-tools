-- Table pour stocker les contextes paramétrables du coach commercial
-- (ambition annuelle, structure d'acquisition) avec historique par année
CREATE TABLE IF NOT EXISTS commercial_coach_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_type TEXT NOT NULL CHECK (context_type IN ('ambition', 'acquisition_structure')),
  year INT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(context_type, year)
);

-- RLS
ALTER TABLE commercial_coach_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_commercial_coach_contexts"
  ON commercial_coach_contexts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_commercial_coach_contexts"
  ON commercial_coach_contexts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_commercial_coach_contexts"
  ON commercial_coach_contexts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_delete_commercial_coach_contexts"
  ON commercial_coach_contexts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all_commercial_coach_contexts"
  ON commercial_coach_contexts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
