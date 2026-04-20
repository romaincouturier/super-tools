-- ─────────────────────────────────────────────────────────────────────────────
-- Sync quote → opportunity (CRM card)
--
-- 1. Add company data columns to crm_cards so SIREN lookup can be
--    persisted on the opportunity (not just on the quote snapshot).
-- 2. Add a function that recomputes an opportunity's estimated_value
--    as the MIN amount across all sent quotes (both full quotes and
--    micro-devis) so the CRM dashboard reflects the lowest active offer.
-- 3. Trigger on the quotes table so the recompute is automatic when a
--    quote transitions to 'sent'. MicroDevis flow calls the function
--    explicitly from the edge function.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Company data on crm_cards (SIREN sync target)
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS siren TEXT;
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_cards_siren
  ON public.crm_cards(siren) WHERE siren IS NOT NULL;

-- 2. Recompute helper: MIN across quotes.total_ttc (status='sent')
--    and activity_logs.details->>'total_amount' (action_type='micro_devis_sent').
CREATE OR REPLACE FUNCTION public.recompute_opportunity_estimated_value(p_card_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  min_quote numeric;
  min_micro numeric;
  result numeric;
BEGIN
  SELECT MIN(total_ttc) INTO min_quote
  FROM public.quotes
  WHERE crm_card_id = p_card_id AND status = 'sent' AND total_ttc > 0;

  SELECT MIN((details->>'total_amount')::numeric) INTO min_micro
  FROM public.activity_logs
  WHERE action_type = 'micro_devis_sent'
    AND (details->>'crm_card_id') = p_card_id::text
    AND (details->>'total_amount') IS NOT NULL;

  result := LEAST(COALESCE(min_quote, 'Infinity'::numeric),
                  COALESCE(min_micro, 'Infinity'::numeric));

  IF result = 'Infinity'::numeric THEN
    result := NULL;
  END IF;

  IF result IS NOT NULL THEN
    UPDATE public.crm_cards
    SET estimated_value = result
    WHERE id = p_card_id;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_opportunity_estimated_value(uuid)
  TO authenticated, service_role;

-- 3. Trigger: when a quote row is inserted/updated with status='sent',
--    recompute the linked opportunity's estimated_value.
CREATE OR REPLACE FUNCTION public.quotes_recompute_on_sent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.crm_card_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.total_ttc IS DISTINCT FROM NEW.total_ttc THEN
      PERFORM public.recompute_opportunity_estimated_value(NEW.crm_card_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_recompute_estimated_value ON public.quotes;
CREATE TRIGGER quotes_recompute_estimated_value
  AFTER INSERT OR UPDATE OF status, total_ttc ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.quotes_recompute_on_sent();
