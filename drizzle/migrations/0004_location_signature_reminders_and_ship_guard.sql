ALTER TABLE public.location_contract_signatures
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_location_shipped()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.shipped_confirmed_at IS NOT NULL AND OLD.shipped_confirmed_at IS NULL
     AND NEW.contrat_reference IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.location_contract_signatures s
       WHERE s.order_item_id = NEW.id AND s.location_extension_id IS NULL AND s.status = 'signed'
     ) THEN
    RAISE EXCEPTION 'Contrat de location non signé : le jeu ne peut pas être expédié';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_location_shipped() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_location_shipped ON public.order_items;
CREATE TRIGGER trg_guard_location_shipped BEFORE UPDATE OF shipped_confirmed_at ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_location_shipped();