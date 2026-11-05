CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_str TEXT;
  next_num INTEGER;
BEGIN
  year_str := to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY');
  -- Sérialise les créations concurrentes jusqu'à la fin de la transaction.
  PERFORM pg_advisory_xact_lock(hashtext('support_ticket_number_' || year_str));
  -- SECURITY DEFINER : le MAX porte sur tous les tickets, pas seulement ceux visibles par l'appelant (RLS).
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.support_tickets
  WHERE ticket_number LIKE 'ST-' || year_str || '-%';
  NEW.ticket_number := 'ST-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM PUBLIC, anon, authenticated;