-- Audit blanc : historique des passages (indicateur 32).
--
-- Le guide cite « l'organisation de l'audit interne » parmi les preuves de la
-- démarche d'amélioration continue. Un audit blanc qui ne laisserait aucune
-- trace ne prouverait rien : chaque passage est donc conservé avec les faits
-- constatés ce jour-là, les réponses de l'auditeur et les verdicts.
--
-- `facts` fige l'état mesuré au moment du passage. Sans cela, rejouer un audit
-- de novembre en février donnerait d'autres chiffres et le rapport mentirait
-- sur ce qui avait été constaté.
--
-- Additive et idempotente. Aucune donnée existante n'est modifiée.

CREATE TABLE IF NOT EXISTS public.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  -- Version du référentiel sous laquelle l'audit a été mené : un rapport de
  -- 2026 ne se relit pas à l'aune d'un référentiel de 2029.
  framework_version text NOT NULL DEFAULT '2026-11-01',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  -- Échantillon de sessions tiré pour ce passage, conformément à la conduite
  -- d'audit décrite par le guide.
  sample_training_ids uuid[] NOT NULL DEFAULT '{}',
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_started
  ON public.audit_runs(started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_runs TO authenticated;
GRANT ALL ON public.audit_runs TO service_role;

ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_runs_staff ON public.audit_runs;
CREATE POLICY audit_runs_staff ON public.audit_runs
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_module_access(auth.uid(), 'audit') OR has_module_access(auth.uid(), 'formations'))
  WITH CHECK (is_admin(auth.uid()) OR has_module_access(auth.uid(), 'audit') OR has_module_access(auth.uid(), 'formations'));

COMMENT ON TABLE public.audit_runs IS
  'Passages d''audit blanc : faits constatés, réponses de l''auditeur et verdicts, figés à la date du passage (indicateur 32).';
