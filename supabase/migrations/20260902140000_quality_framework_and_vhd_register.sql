-- Décret n° 2026-728 du 1er août 2026, applicable au 1er novembre 2026.
--
-- Deux apports, tous deux idempotents (règle [042]) :
--
-- 1. Version du référentiel applicable, en réglage plutôt qu'en dur, pour que
--    les données produites sachent dire sous quel texte elles ont été établies.
--    Le basculement V9 -> 2026-11-01 se fera depuis l'écran de paramètres, sans
--    redéploiement.
--
-- 2. Indicateur 12, dont le décret étend le libellé : « Il s'assure de la
--    prévention et du traitement de toute situation de violence, dont les
--    violences sexistes et sexuelles, de harcèlement ou de discrimination dans
--    le cadre de leur formation. » D'où une procédure versionnée et un registre
--    de signalements. VHD, dans les noms de tables, désigne ces trois objets :
--    violences, harcèlement, discriminations.
--
-- Le récit d'un signalement vit dans une table séparée, volontairement exclue
-- de la sauvegarde Google Drive : le registre reste sauvegardé et prouve que
-- les signalements sont traités, sans recopier le témoignage nominatif d'une
-- victime hors du système d'information.

-- ─── 1. Version du référentiel ──────────────────────────────────────────────

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'quality_framework_version',
  'V9',
  'Version du référentiel national qualité appliquée aux contrôles et aux preuves. Passer à 2026-11-01 le 1er novembre 2026 (décret n° 2026-728).'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ─── 2. Procédure de prévention et de traitement ────────────────────────────

CREATE TABLE IF NOT EXISTS public.vhd_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  content text NOT NULL DEFAULT '',
  -- Interlocuteur à qui s'adresser, communiqué aux apprenants avec la procédure.
  contact_name text,
  contact_email text,
  effective_from date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  -- Version du référentiel sous laquelle la procédure a été rédigée.
  framework_version text NOT NULL DEFAULT 'V9',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vhd_procedures_version
  ON public.vhd_procedures(version);

-- Une seule procédure active à la fois : c'est elle qui est communiquée aux
-- apprenants. Toutes les lignes retenues par le filtre portent la même valeur,
-- donc l'unicité sur cette colonne borne le filtre à une ligne.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vhd_procedures_single_active
  ON public.vhd_procedures(status) WHERE status = 'active';

-- ─── 3. Registre des signalements ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vhd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_at date NOT NULL DEFAULT CURRENT_DATE,
  -- Une formation n'est pas toujours identifiable, et l'exiger empêcherait
  -- d'enregistrer un signalement anonyme ou hors session.
  training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'autre'
    CHECK (channel IN ('mail', 'telephone', 'oral', 'formulaire', 'autre')),
  -- Les trois catégories nommées par le décret, plus une issue non qualifiée.
  category text NOT NULL DEFAULT 'autre'
    CHECK (category IN ('violence', 'violence_sexiste_sexuelle', 'harcelement', 'discrimination', 'autre')),
  handled_by text,
  actions_taken text,
  due_date date,
  status text NOT NULL DEFAULT 'recu'
    CHECK (status IN ('recu', 'en_analyse', 'mesures_prises', 'cloture')),
  closed_at timestamptz,
  procedure_id uuid REFERENCES public.vhd_procedures(id) ON DELETE SET NULL,
  framework_version text NOT NULL DEFAULT 'V9',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhd_reports_status
  ON public.vhd_reports(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_vhd_reports_training
  ON public.vhd_reports(training_id);

-- ─── 4. Récit du signalement, hors sauvegarde ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.vhd_report_narratives (
  report_id uuid PRIMARY KEY REFERENCES public.vhd_reports(id) ON DELETE CASCADE,
  narrative text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Accès ───────────────────────────────────────────────────────────────
-- Réservé aux administrateurs, posé dès la création des tables et jamais
-- ouvert puis refermé. Un non-administrateur ne voit aucune ligne.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vhd_procedures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vhd_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vhd_report_narratives TO authenticated;
GRANT ALL ON public.vhd_procedures TO service_role;
GRANT ALL ON public.vhd_reports TO service_role;
GRANT ALL ON public.vhd_report_narratives TO service_role;

ALTER TABLE public.vhd_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhd_report_narratives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vhd_procedures_admin ON public.vhd_procedures;
CREATE POLICY vhd_procedures_admin ON public.vhd_procedures
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_reports_admin ON public.vhd_reports;
CREATE POLICY vhd_reports_admin ON public.vhd_reports
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_report_narratives_admin ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_admin ON public.vhd_report_narratives
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ─── 6. Horodatage ──────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_vhd_procedures_updated_at ON public.vhd_procedures;
CREATE TRIGGER trg_vhd_procedures_updated_at
  BEFORE UPDATE ON public.vhd_procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vhd_reports_updated_at ON public.vhd_reports;
CREATE TRIGGER trg_vhd_reports_updated_at
  BEFORE UPDATE ON public.vhd_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vhd_report_narratives_updated_at ON public.vhd_report_narratives;
CREATE TRIGGER trg_vhd_report_narratives_updated_at
  BEFORE UPDATE ON public.vhd_report_narratives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
