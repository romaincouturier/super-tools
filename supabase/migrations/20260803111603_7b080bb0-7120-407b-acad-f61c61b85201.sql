UPDATE public.inbound_emails
SET from_email = concat(from_name, from_email), from_name = NULL
WHERE from_name IS NOT NULL
  AND from_name NOT LIKE '%@%.%'
  AND from_name LIKE '%@%'
  AND from_email !~ '@';