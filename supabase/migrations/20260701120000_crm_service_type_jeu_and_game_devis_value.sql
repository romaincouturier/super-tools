-- ─────────────────────────────────────────────────────────────────────────────
-- Opportunités "jeu" + devis de jeu synchronisé sur l'opportunité
--
-- 1. Autorise service_type = 'jeu' sur crm_cards (en plus de 'formation'/'mission').
-- 2. Étend recompute_opportunity_estimated_value pour intégrer les devis de jeu
--    (activity_logs.action_type = 'game_devis_sent'), comme les micro-devis
--    formation, afin que le montant de l'opportunité reflète l'offre la plus basse.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Contrainte service_type
ALTER TABLE public.crm_cards DROP CONSTRAINT IF EXISTS crm_cards_service_type_check;
ALTER TABLE public.crm_cards
  ADD CONSTRAINT crm_cards_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('formation', 'mission', 'jeu'));

-- 2. Recompute du montant : MIN sur quotes (status='sent'), micro-devis formation
--    et devis de jeu.
CREATE OR REPLACE FUNCTION public.recompute_opportunity_estimated_value(p_card_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  min_quote numeric;
  min_micro numeric;
  min_game numeric;
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

  SELECT MIN((details->>'total_amount')::numeric) INTO min_game
  FROM public.activity_logs
  WHERE action_type = 'game_devis_sent'
    AND (details->>'crm_card_id') = p_card_id::text
    AND (details->>'total_amount') IS NOT NULL;

  result := LEAST(COALESCE(min_quote, 'Infinity'::numeric),
                  COALESCE(min_micro, 'Infinity'::numeric),
                  COALESCE(min_game,  'Infinity'::numeric));

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
