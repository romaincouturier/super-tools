
ALTER TABLE public.training_participants
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_zip text,
  ADD COLUMN IF NOT EXISTS company_city text;

UPDATE public.training_participants tp
SET company_address = c.address,
    company_zip     = COALESCE(tp.company_zip, c.postal_code),
    company_city    = COALESCE(tp.company_city, c.city)
FROM (
  SELECT DISTINCT ON (lower(company)) company, address, postal_code, city
  FROM public.crm_cards
  WHERE company IS NOT NULL
    AND (address IS NOT NULL OR postal_code IS NOT NULL OR city IS NOT NULL)
  ORDER BY lower(company), updated_at DESC NULLS LAST
) c
WHERE tp.company IS NOT NULL
  AND lower(tp.company) = lower(c.company)
  AND (tp.company_address IS NULL OR tp.company_address = '');
