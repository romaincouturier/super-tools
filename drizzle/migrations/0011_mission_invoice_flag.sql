ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS invoice_to_issue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_to_issue_note text,
  ADD COLUMN IF NOT EXISTS invoice_to_issue_amount numeric,
  ADD COLUMN IF NOT EXISTS invoice_to_issue_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.clear_mission_invoice_flag_on_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NOT NULL AND btrim(NEW.invoice_number) <> ''
     AND (TG_OP = 'INSERT' OR OLD.invoice_number IS DISTINCT FROM NEW.invoice_number) THEN
    UPDATE public.missions
       SET invoice_to_issue = false, invoice_to_issue_note = NULL,
           invoice_to_issue_amount = NULL, invoice_to_issue_set_at = NULL
     WHERE id = NEW.mission_id AND invoice_to_issue;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clear_mission_invoice_flag ON public.mission_activities;
CREATE TRIGGER trg_clear_mission_invoice_flag
AFTER INSERT OR UPDATE OF invoice_number ON public.mission_activities
FOR EACH ROW EXECUTE FUNCTION public.clear_mission_invoice_flag_on_invoice();

UPDATE public.agent_schema_registry
SET columns = columns || '[
  {"name":"invoice_to_issue","type":"BOOL","description":"Facture à émettre signalée (facturation intermédiaire), désactivée automatiquement dès qu une facture est saisie"},
  {"name":"invoice_to_issue_note","type":"TEXT","description":"Précision libre (ex. acompte 50 %)"},
  {"name":"invoice_to_issue_amount","type":"NUMERIC","description":"Montant HT à facturer, optionnel"},
  {"name":"invoice_to_issue_set_at","type":"TIMESTAMPTZ"}
]'::jsonb
WHERE table_name = 'missions';