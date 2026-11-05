CREATE TABLE public.quality_risk_improvements (
  risk_id uuid NOT NULL REFERENCES public.quality_risks(id) ON DELETE CASCADE,
  improvement_id uuid NOT NULL REFERENCES public.improvements(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (risk_id, improvement_id)
);
CREATE INDEX idx_quality_risk_improvements_improvement ON public.quality_risk_improvements(improvement_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_risk_improvements TO authenticated;
GRANT ALL ON public.quality_risk_improvements TO service_role;
ALTER TABLE public.quality_risk_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY quality_risk_improvements_manage ON public.quality_risk_improvements
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'risques'::text) OR has_module_access(auth.uid(), 'formations'::text) OR is_admin(auth.uid()))
  WITH CHECK (has_module_access(auth.uid(), 'risques'::text) OR has_module_access(auth.uid(), 'formations'::text) OR is_admin(auth.uid()));

INSERT INTO public.quality_risk_improvements (risk_id, improvement_id)
SELECT id, improvement_id FROM public.quality_risks WHERE improvement_id IS NOT NULL
ON CONFLICT DO NOTHING;
COMMENT ON COLUMN public.quality_risks.improvement_id IS 'DEPRECATED: replaced by quality_risk_improvements';

CREATE OR REPLACE FUNCTION public.quality_risks_default_review_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.review_date IS NULL AND NEW.status <> 'closed' THEN
    NEW.review_date := ((now() AT TIME ZONE 'Europe/Paris')::date + interval '1 month')::date;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_quality_risks_default_review_date
  BEFORE INSERT OR UPDATE ON public.quality_risks
  FOR EACH ROW EXECUTE FUNCTION public.quality_risks_default_review_date();