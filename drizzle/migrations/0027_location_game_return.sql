ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS location_returned_at timestamptz;
COMMENT ON COLUMN public.order_items.location_returned_at IS 'Date de confirmation de réception du jeu loué ; distincte de la remise initiale et de l’échéance contractuelle.';
CREATE OR REPLACE FUNCTION public.guard_location_processed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kanban_status = 'processed'
     AND OLD.kanban_status IS DISTINCT FROM 'processed'
     AND NEW.contrat_reference IS NOT NULL
     AND NEW.location_returned_at IS NULL
     AND (NEW.location_end_date IS NULL OR NEW.location_end_date > (now() AT TIME ZONE 'Europe/Paris')::date) THEN
    RAISE EXCEPTION 'Location en cours : confirmez le retour du jeu ou attendez son échéance (%)', COALESCE(NEW.location_end_date::text, 'non renseignée');
  END IF;
  RETURN NEW;
END $$;