-- Retours libres reçus après une formation, hors questionnaires (email, téléphone, autre).
-- Les questionnaires à chaud et à froid ont leurs propres tables ; celle-ci ne garde que
-- le verbatim, rattaché à la session, au participant (facultatif) et donc à la formation
-- du catalogue via trainings.catalog_id.

CREATE TABLE IF NOT EXISTS public.training_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.training_participants(id) ON DELETE SET NULL,
  author_role text NOT NULL DEFAULT 'participant' CHECK (author_role IN ('participant', 'commanditaire', 'autre')),
  author_name text,
  source text NOT NULL DEFAULT 'email' CHECK (source IN ('email', 'telephone', 'oral', 'autre')),
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  consent_publication boolean NOT NULL DEFAULT false,
  gmail_message_id text UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_feedbacks_training ON public.training_feedbacks(training_id);
CREATE INDEX IF NOT EXISTS idx_training_feedbacks_participant ON public.training_feedbacks(participant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_feedbacks TO authenticated;
GRANT ALL ON public.training_feedbacks TO service_role;
ALTER TABLE public.training_feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Formations staff manage training feedbacks" ON public.training_feedbacks;
CREATE POLICY "Formations staff manage training feedbacks" ON public.training_feedbacks
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));

DROP POLICY IF EXISTS staff_only_select ON public.training_feedbacks;
CREATE POLICY staff_only_select ON public.training_feedbacks
  AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_staff_user());

DROP TRIGGER IF EXISTS trg_training_feedbacks_updated_at ON public.training_feedbacks;
CREATE TRIGGER trg_training_feedbacks_updated_at BEFORE UPDATE ON public.training_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.agent_schema_registry (table_name, description, display_order) VALUES
  ('training_feedbacks', 'Retours libres reçus après une formation (email, téléphone, oral), hors questionnaires : verbatim, session, participant, accord de citation', 66)
ON CONFLICT (table_name) DO NOTHING;
