ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_kanban_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_kanban_status_check CHECK (kanban_status IN (
  'to_validate','received','to_ship','dropshipping','location_pending','location_active','processed','blocked'
));

CREATE OR REPLACE FUNCTION public.guard_location_processed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kanban_status = 'processed'
     AND OLD.kanban_status IS DISTINCT FROM 'processed'
     AND NEW.contrat_reference IS NOT NULL
     AND (NEW.location_end_date IS NULL OR NEW.location_end_date > (now() AT TIME ZONE 'Europe/Paris')::date) THEN
    RAISE EXCEPTION 'Location en cours : elle ne peut être terminée qu''à son échéance (%)', COALESCE(NEW.location_end_date::text, 'non renseignée');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_location_processed ON public.order_items;
CREATE TRIGGER trg_guard_location_processed BEFORE UPDATE OF kanban_status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_location_processed();

-- Backfill : échéance = signature + 30 jours, locations non échues repassent en cours
UPDATE public.order_items oi
SET location_end_date = ((s.signed_at AT TIME ZONE 'Europe/Paris')::date + 30)
FROM public.location_contract_signatures s
WHERE s.order_item_id = oi.id AND s.location_extension_id IS NULL
  AND s.signed_at IS NOT NULL AND oi.location_end_date IS NULL;

UPDATE public.order_items
SET kanban_status = 'location_active'
WHERE contrat_reference IS NOT NULL AND kanban_status = 'processed'
  AND location_end_date IS NOT NULL AND location_end_date > (now() AT TIME ZONE 'Europe/Paris')::date;