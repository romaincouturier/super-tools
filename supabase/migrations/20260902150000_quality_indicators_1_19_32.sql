-- Décret n° 2026-728 — indicateurs 1, 19 et 32.
-- Suite de 20260902140000 (socle de version + indicateur 12). Idempotente.
--
-- Indicateur 1 : le décret ajoute au libellé le « type de reconnaissance de la
--   formation délivrée » et sépare les modalités « pédagogiques et de
--   financements ». Le délai d'accès et l'accessibilité aux personnes en
--   situation de handicap étaient déjà exigés par le V9 sans exister en base.
--
-- Indicateur 19 : « Au-delà d'un nombre d'intervenants par formation, fixé par
--   arrêté du ministre chargé de la formation professionnelle, le prestataire
--   dispose d'un référent pédagogique par formation chargé d'assurer la
--   coordination pédagogique entre les intervenants. »
--
-- Indicateur 32 : le décret ajoute « ainsi qu'une analyse des risques sur la
--   qualité des formations délivrées » à la démarche d'amélioration continue,
--   qui elle existe déjà (table improvements).

-- ─── Indicateur 1 : information du public ───────────────────────────────────

ALTER TABLE public.formation_configs
  -- Contraint aux formes non certifiantes : l'organisme ne prépare aucune
  -- certification professionnelle, et le décret interdit toute mention de
  -- nature à induire le public en erreur sur les droits conférés.
  ADD COLUMN IF NOT EXISTS recognition_type text
    CHECK (recognition_type IN ('attestation_formation', 'attestation_competences', 'autre')),
  ADD COLUMN IF NOT EXISTS funding_terms text,
  ADD COLUMN IF NOT EXISTS access_delay text,
  ADD COLUMN IF NOT EXISTS accessibility_terms text;

COMMENT ON COLUMN public.formation_configs.recognition_type IS
  'Type de reconnaissance délivrée (indicateur 1). Jamais « certification » : organisme non certificateur.';
COMMENT ON COLUMN public.formation_configs.access_delay IS
  'Délai entre la demande et l''entrée en formation (indicateur 1).';

-- ─── Indicateur 19 : référent pédagogique ───────────────────────────────────
-- Porté par la session : c'est au niveau d'une action donnée que se pose la
-- coordination entre intervenants. Distinct du formateur principal
-- (trainer_id), qui peut être l'un des intervenants coordonnés.

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS pedagogical_referent_name text,
  ADD COLUMN IF NOT EXISTS pedagogical_referent_email text,
  ADD COLUMN IF NOT EXISTS pedagogical_referent_designated_at date;

COMMENT ON COLUMN public.trainings.pedagogical_referent_name IS
  'Référent pédagogique chargé de la coordination entre intervenants (indicateur 19).';

-- Le seuil déclencheur est renvoyé par le décret à un arrêté non paru.
-- Valeur vide tant qu'il n'est pas publié : aucun contrôle ne se déclenche et
-- rien ne bloque la saisie. Le jour de sa parution, il se pose depuis l'écran
-- de paramètres, sans redéploiement.
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'distance_intervenant_threshold',
  '',
  'Nombre d''intervenants par formation au-delà duquel un référent pédagogique est requis (indicateur 19). Fixé par arrêté ; laisser vide tant qu''il n''est pas publié.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ─── Indicateur 32 : analyse des risques qualité ────────────────────────────

CREATE TABLE IF NOT EXISTS public.quality_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  -- Un risque peut viser une formation du catalogue, une modalité, ou être
  -- transverse : les trois rattachements restent facultatifs.
  formation_config_id uuid REFERENCES public.formation_configs(id) ON DELETE SET NULL,
  modality text CHECK (modality IN ('presentiel', 'distanciel_synchrone', 'elearning', 'mixte')),
  cause text,
  -- Échelles de 1 à 4, sans valeur médiane : forcer le choix entre plutôt
  -- faible et plutôt fort évite le réflexe du « moyen » qui ne décide rien.
  probability smallint NOT NULL DEFAULT 1 CHECK (probability BETWEEN 1 AND 4),
  impact smallint NOT NULL DEFAULT 1 CHECK (impact BETWEEN 1 AND 4),
  -- Criticité calculée par la base : la règle est lisible dans le schéma et
  -- personne ne peut saisir une criticité qui contredit ses deux facteurs.
  criticality smallint GENERATED ALWAYS AS (probability * impact) STORED,
  preventive_measure text,
  owner text,
  review_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'monitored', 'closed')),
  -- Origine réelle du risque, quand il vient d'un événement constaté.
  reclamation_id uuid REFERENCES public.reclamations(id) ON DELETE SET NULL,
  -- Action d'amélioration engagée en réponse : c'est le lien entre prévention
  -- et correction que demande la démarche d'amélioration continue.
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
