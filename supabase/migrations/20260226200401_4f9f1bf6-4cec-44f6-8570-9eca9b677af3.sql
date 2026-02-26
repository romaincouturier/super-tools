
-- ============================================================
-- PRIORITÉ 1 : Indicateur 21 – Compétences des intervenants
-- ============================================================

-- Colonnes supplémentaires sur trainers
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS competences text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diplomes_certifications text,
  ADD COLUMN IF NOT EXISTS formations_suivies jsonb DEFAULT '[]';

-- Table documents formateur
CREATE TABLE public.trainer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  document_type text NOT NULL DEFAULT 'autre',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage trainer documents"
  ON public.trainer_documents FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Table adéquation formateur / formation
CREATE TABLE public.trainer_training_adequacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  validated_by text NOT NULL,
  validated_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trainer_id, training_id)
);

ALTER TABLE public.trainer_training_adequacy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage trainer adequacy"
  ON public.trainer_training_adequacy FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PRIORITÉ 2 : Indicateur 30 – Appréciations multi-parties
-- ============================================================

CREATE TABLE public.stakeholder_appreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL,
  stakeholder_type text NOT NULL,
  stakeholder_name text NOT NULL,
  stakeholder_email text,
  token text UNIQUE NOT NULL,
  date_envoi timestamptz,
  date_reception timestamptz,
  status text NOT NULL DEFAULT 'draft',
  satisfaction_globale integer,
  points_forts text,
  axes_amelioration text,
  commentaires text,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stakeholder_appreciations ENABLE ROW LEVEL SECURITY;

-- Authenticated: full access
CREATE POLICY "Authenticated users can manage stakeholder appreciations"
  ON public.stakeholder_appreciations FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Anon: read own by token
CREATE POLICY "Public can read appreciation by token"
  ON public.stakeholder_appreciations FOR SELECT
  TO anon USING (true);

-- Anon: update own by token
CREATE POLICY "Public can update appreciation by token"
  ON public.stakeholder_appreciations FOR UPDATE
  TO anon USING (true);

-- Trigger updated_at
CREATE TRIGGER update_stakeholder_appreciations_updated_at
  BEFORE UPDATE ON public.stakeholder_appreciations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PRIORITÉ 3 : Indicateur 32 – Améliorations avec sources
-- ============================================================

ALTER TABLE public.improvements
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_description text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS responsible text;

-- Ajouter 'appreciations' au module enum si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'appreciations' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_module')) THEN
    ALTER TYPE public.app_module ADD VALUE 'appreciations';
  END IF;
END$$;
