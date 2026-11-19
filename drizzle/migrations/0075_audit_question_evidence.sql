CREATE TABLE public.audit_question_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL CHECK (question_id ~ '^[0-9]+\.[a-z0-9_]+$'),
  indicator integer NOT NULL CHECK (indicator BETWEEN 1 AND 32),
  answer text NOT NULL CHECK (answer IN ('oui','non')),
  evidence_summary text NOT NULL CHECK (length(btrim(evidence_summary)) > 0 AND length(evidence_summary) <= 5000),
  evidence_urls text[] NOT NULL DEFAULT '{}',
  evidence_details jsonb,
  checked_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL CHECK (source_type IN ('human','agent')),
  source_label text NOT NULL CHECK (length(source_label) BETWEEN 1 AND 200),
  recorded_by uuid DEFAULT auth.uid(),
  audit_run_id uuid REFERENCES public.audit_runs(id) ON DELETE SET NULL,
  CHECK (cardinality(evidence_urls) <= 50),
  CHECK (source_type <> 'agent' OR source_label ~ '^agent:.+')
);
CREATE INDEX audit_question_evidence_question_idx ON public.audit_question_evidence (question_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.audit_question_evidence TO authenticated;
GRANT ALL ON public.audit_question_evidence TO service_role;
ALTER TABLE public.audit_question_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_question_evidence_read ON public.audit_question_evidence FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_module_access(auth.uid(),'audit') OR has_module_access(auth.uid(),'formations'));
CREATE POLICY audit_question_evidence_insert ON public.audit_question_evidence FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR has_module_access(auth.uid(),'audit') OR has_module_access(auth.uid(),'formations')) AND recorded_by = auth.uid());

CREATE OR REPLACE FUNCTION public.audit_question_evidence_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.recorded_by := auth.uid(); END IF;
  NEW.recorded_at := now();
  IF NEW.checked_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'La date du contrôle ne peut pas être dans le futur';
  END IF;
  IF split_part(NEW.question_id, '.', 1)::int <> NEW.indicator THEN
    RAISE EXCEPTION 'La question % n''appartient pas à l''indicateur %', NEW.question_id, NEW.indicator;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_question_evidence_guard BEFORE INSERT ON public.audit_question_evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_question_evidence_guard();
COMMENT ON TABLE public.audit_question_evidence IS 'Journal immuable des réponses et preuves aux questions manuelles de l''audit blanc (humain ou agent MCP).';