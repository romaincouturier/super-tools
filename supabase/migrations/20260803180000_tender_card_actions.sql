-- Bascule de la prochaine action sur les cartes issues d'un marché public.
--
-- Intitulé validé : « Retirer le DCE et décider de candidater » à la création,
-- puis « Déposer l'offre avant le {date limite} » à sept jours de l'échéance.
-- Sans cette bascule, la carte garde jusqu'au bout une action qui n'a plus de
-- sens, et l'échéance réelle n'apparaît nulle part dans le fil du matin.
--
-- Voir docs/marches-publics.md.

CREATE OR REPLACE FUNCTION public.refresh_tender_card_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  UPDATE public.crm_cards c
     SET waiting_next_action_text =
           'Déposer l''offre avant le ' || to_char(c.expected_close_date, 'DD/MM/YYYY'),
         -- La date d'action revient à aujourd'hui pour que la carte remonte
         -- dans les alertes du matin jusqu'à ce qu'elle soit traitée.
         waiting_next_action_date = (now() AT TIME ZONE 'Europe/Paris')::date,
         status_operational = 'WAITING'
   WHERE c.sales_status = 'OPEN'
     AND c.acquisition_source = 'marche_public'
     AND c.expected_close_date IS NOT NULL
     AND c.expected_close_date >= (now() AT TIME ZONE 'Europe/Paris')::date
     AND c.expected_close_date <= (now() AT TIME ZONE 'Europe/Paris')::date + 7
     -- Idempotent : une carte déjà basculée n'est pas réécrite chaque matin,
     -- sinon sa date d'action serait repoussée indéfiniment.
     AND c.waiting_next_action_text IS DISTINCT FROM
         ('Déposer l''offre avant le ' || to_char(c.expected_close_date, 'DD/MM/YYYY'));
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_tender_card_actions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_tender_card_actions() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_tender_card_actions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_tender_card_actions() TO service_role;

-- Juste avant l'expiration des avis et la génération des actions du matin.
SELECT cron.unschedule('refresh-tender-card-actions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-tender-card-actions');

SELECT cron.schedule(
  'refresh-tender-card-actions',
  '10 6 * * *',
  $$SELECT public.refresh_tender_card_actions();$$
);
