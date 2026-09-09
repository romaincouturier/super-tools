-- 20260902150000_quality_indicators_1_19_32.sql
ALTER TABLE public.formation_configs
  ADD COLUMN IF NOT EXISTS recognition_type text
    CHECK (recognition_type IN ('attestation_formation', 'attestation_competences', 'autre')),
  ADD COLUMN IF NOT EXISTS funding_terms text,
  ADD COLUMN IF NOT EXISTS access_delay text,
  ADD COLUMN IF NOT EXISTS accessibility_terms text;

COMMENT ON COLUMN public.formation_configs.recognition_type IS
  'Type de reconnaissance délivrée (indicateur 1). Jamais « certification » : organisme non certificateur.';
COMMENT ON COLUMN public.formation_configs.access_delay IS
  'Délai entre la demande et l''entrée en formation (indicateur 1).';

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS pedagogical_referent_name text,
  ADD COLUMN IF NOT EXISTS pedagogical_referent_email text,
  ADD COLUMN IF NOT EXISTS pedagogical_referent_designated_at date;

COMMENT ON COLUMN public.trainings.pedagogical_referent_name IS
  'Référent pédagogique chargé de la coordination entre intervenants (indicateur 19).';

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'distance_intervenant_threshold',
  '',
  'Nombre d''intervenants par formation au-delà duquel un référent pédagogique est requis (indicateur 19). Fixé par arrêté ; laisser vide tant qu''il n''est pas publié.'
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.quality_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  formation_config_id uuid REFERENCES public.formation_configs(id) ON DELETE SET NULL,
  modality text CHECK (modality IN ('presentiel', 'distanciel_synchrone', 'elearning', 'mixte')),
  cause text,
  probability smallint NOT NULL DEFAULT 1 CHECK (probability BETWEEN 1 AND 4),
  impact smallint NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 4),
  criticality smallint GENERATED ALWAYS AS (probability * impact) STORED,
  preventive_measure text,
  owner text,
  review_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'monitored', 'closed')),
  reclamation_id uuid REFERENCES public.reclamations(id) ON DELETE SET NULL,
  improvement_id uuid REFERENCES public.improvements(id) ON DELETE SET NULL,
  framework_version text NOT NULL DEFAULT 'V9',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_risks_open
  ON public.quality_risks(criticality DESC, review_date) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_quality_risks_formation
  ON public.quality_risks(formation_config_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_risks TO authenticated;
GRANT ALL ON public.quality_risks TO service_role;

ALTER TABLE public.quality_risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quality_risks_manage ON public.quality_risks;
CREATE POLICY quality_risks_manage ON public.quality_risks
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'formations') OR is_admin(auth.uid()))
  WITH CHECK (has_module_access(auth.uid(), 'formations') OR is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_quality_risks_updated_at ON public.quality_risks;
CREATE TRIGGER trg_quality_risks_updated_at
  BEFORE UPDATE ON public.quality_risks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();