
-- Add missing woocommerce_product_id column to training_evaluations
ALTER TABLE public.training_evaluations
  ADD COLUMN IF NOT EXISTS woocommerce_product_id integer;

-- Create rate limit table
CREATE TABLE IF NOT EXISTS public.formulaire_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

-- 20260304180000 avait créé la table avec attempted_at ; c'est requested_at
-- qui a gagné en production. Le CREATE ci-dessus étant sans effet quand la
-- table existe déjà, on aligne la colonne.
DO $do$ BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'formulaire_rate_limits'
    AND column_name = 'attempted_at'
) AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'formulaire_rate_limits'
    AND column_name = 'requested_at'
) THEN
  ALTER TABLE public.formulaire_rate_limits RENAME COLUMN attempted_at TO requested_at;
END IF; END $do$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_formulaire_rate_limits_ip_time
  ON public.formulaire_rate_limits (ip_address, requested_at);

-- Create the rate limit function
-- La version de 20260304180000 déclarait des valeurs par défaut : CREATE OR
-- REPLACE ne peut pas les retirer, il faut supprimer la fonction d'abord.
DROP FUNCTION IF EXISTS public.check_formulaire_rate_limit(text, integer, integer);

CREATE OR REPLACE FUNCTION public.check_formulaire_rate_limit(
  p_ip_address text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Clean old entries
  DELETE FROM public.formulaire_rate_limits
  WHERE requested_at < now() - (p_window_seconds || ' seconds')::interval;

  -- Count recent requests
  SELECT count(*) INTO v_count
  FROM public.formulaire_rate_limits
  WHERE ip_address = p_ip_address
    AND requested_at > now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  -- Record this request
  INSERT INTO public.formulaire_rate_limits (ip_address) VALUES (p_ip_address);

  RETURN true;
END;
$$;
