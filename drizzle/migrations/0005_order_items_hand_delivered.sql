ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS hand_delivered_at timestamptz;
COMMENT ON COLUMN public.order_items.hand_delivered_at IS 'Remise en main propre : aucun envoi transporteur attendu, sort la ligne des alertes et du suivi d''expédition.';

CREATE OR REPLACE FUNCTION public.guard_location_shipped()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ((NEW.shipped_confirmed_at IS NOT NULL AND OLD.shipped_confirmed_at IS NULL)
      OR (NEW.hand_delivered_at IS NOT NULL AND OLD.hand_delivered_at IS NULL))
     AND NEW.contrat_reference IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.location_contract_signatures s
       WHERE s.order_item_id = NEW.id AND s.location_extension_id IS NULL AND s.status = 'signed'
     ) THEN
    RAISE EXCEPTION 'Contrat de location non signé : le jeu ne peut pas être remis ni expédié';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_location_shipped ON public.order_items;
CREATE TRIGGER trg_guard_location_shipped BEFORE UPDATE OF shipped_confirmed_at, hand_delivered_at ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_location_shipped();