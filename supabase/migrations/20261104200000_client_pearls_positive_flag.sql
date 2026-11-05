-- Perles clients : seules les perles positives (best of) remontent sur le tableau
-- de bord. Les autres restent consultables dans la page Perles clients.

ALTER TABLE public.client_pearls
  ADD COLUMN IF NOT EXISTS is_positive BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_random_client_pearl(p_exclude UUID DEFAULT NULL)
RETURNS SETOF public.client_pearls
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.client_pearls
  WHERE archived = false
    AND is_positive = true
    AND (p_exclude IS NULL OR id <> p_exclude)
  ORDER BY random()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_random_client_pearl(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_random_client_pearl(UUID) TO authenticated;
