UPDATE public.inbound_emails
SET from_email = concat(from_name, from_email), from_name = NULL
WHERE from_email NOT LIKE '%@%'
  AND from_name LIKE '%@%';