-- =============================================================================
-- Formulaire Protection: rate limiting + support for unknown participants
-- =============================================================================

-- =============================================================================
-- 1. Make participant_id and training_id nullable in questionnaire_besoins
--    to allow storing responses from unknown WooCommerce participants
-- =============================================================================
ALTER TABLE public.questionnaire_besoins
  ALTER COLUMN participant_id DROP NOT NULL,
  ALTER COLUMN training_id DROP NOT NULL;

-- Add woocommerce_product_id for traceability on orphan entries
ALTER TABLE public.questionnaire_besoins
  ADD COLUMN IF NOT EXISTS woocommerce_product_id INT;

-- Drop the unique constraint on (training_id, participant_id) and replace
-- with a partial unique index that only applies when both are non-null
ALTER TABLE public.questionnaire_besoins
  DROP CONSTRAINT IF EXISTS questionnaire_besoins_training_id_participant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_besoins_training_participant
  ON public.questionnaire_besoins (training_id, participant_id)
  WHERE training_id IS NOT NULL AND participant_id IS NOT NULL;

-- =============================================================================
-- 2. Make participant_id and training_id nullable in training_evaluations
-- =============================================================================
ALTER TABLE public.training_evaluations
  ALTER COLUMN participant_id DROP NOT NULL,
  ALTER COLUMN training_id DROP NOT NULL;

-- Add woocommerce_product_id for traceability on orphan entries
ALTER TABLE public.training_evaluations
  ADD COLUMN IF NOT EXISTS woocommerce_product_id INT;

-- =============================================================================
-- 3. Allow anon to INSERT into questionnaire_besoins and training_evaluations
--    (needed for the SECURITY DEFINER function to create orphan entries)
-- =============================================================================

-- questionnaire_besoins: anon INSERT policy for orphan entries (via token)
CREATE POLICY "Anon can insert orphan questionnaires"
  ON public.questionnaire_besoins FOR INSERT TO anon
  WITH CHECK (participant_id IS NULL AND training_id IS NULL AND token IS NOT NULL);

-- training_evaluations: anon INSERT policy for orphan entries (via token)
CREATE POLICY "Anon can insert orphan evaluations"
  ON public.training_evaluations FOR INSERT TO anon
  WITH CHECK (participant_id IS NULL AND training_id IS NULL AND token IS NOT NULL);

-- =============================================================================
-- 4. Rate limiting table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.formulaire_rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formulaire_rate_limits_ip_time
  ON public.formulaire_rate_limits (ip_address, attempted_at DESC);

ALTER TABLE public.formulaire_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access (only via SECURITY DEFINER)
CREATE POLICY "No direct access to rate limits"
  ON public.formulaire_rate_limits FOR ALL
  USING (false);

-- =============================================================================
-- 5. Rate limit check function
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_formulaire_rate_limit(
  p_ip_address TEXT,
  p_max_requests INT DEFAULT 10,
  p_window_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Clean old entries (older than 1 hour)
  DELETE FROM formulaire_rate_limits
  WHERE attempted_at < now() - INTERVAL '1 hour';

  -- Count recent attempts
  SELECT COUNT(*) INTO v_count
  FROM formulaire_rate_limits
  WHERE ip_address = p_ip_address
    AND attempted_at > now() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Record this attempt
  INSERT INTO formulaire_rate_limits (ip_address) VALUES (p_ip_address);

  -- Return true if under limit
  RETURN v_count < p_max_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_formulaire_rate_limit(TEXT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_formulaire_rate_limit(TEXT, INT, INT) TO authenticated;

-- =============================================================================
-- 6. Replace resolve_formulaire_token to return structured JSON
--    and handle both known and unknown participants
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_formulaire_token(
  p_email TEXT,
  p_product_id INT,
  p_form_type TEXT -- 'besoins' or 'evaluation'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_id UUID;
  v_training_id UUID;
  v_participant_id UUID;
  v_participant RECORD;
  v_token TEXT;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_product_id IS NULL OR p_form_type IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  -- Step 1: Find catalog by product_id (check formulas first, then catalog-level)
  SELECT fc.id INTO v_catalog_id
  FROM formation_formulas ff
  JOIN formation_configs fc ON fc.id = ff.formation_config_id
  WHERE ff.woocommerce_product_id = p_product_id
  LIMIT 1;

  IF v_catalog_id IS NULL THEN
    SELECT id INTO v_catalog_id
    FROM formation_configs
    WHERE woocommerce_product_id = p_product_id
    LIMIT 1;
  END IF;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object('status', 'product_not_found');
  END IF;

  -- Step 2: Find participant by email in trainings linked to this catalog
  SELECT tp.id, tp.training_id, tp.first_name, tp.last_name, tp.company, tp.email
  INTO v_participant
  FROM training_participants tp
  JOIN trainings t ON t.id = tp.training_id
  WHERE lower(tp.email) = lower(p_email)
    AND t.catalog_id = v_catalog_id
  ORDER BY tp.added_at DESC
  LIMIT 1;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'participant_not_found',
      'catalog_id', v_catalog_id
    );
  END IF;

  v_participant_id := v_participant.id;
  v_training_id := v_participant.training_id;

  -- Step 3: Find or create the form record
  IF p_form_type = 'besoins' THEN
    SELECT token INTO v_token
    FROM questionnaire_besoins
    WHERE participant_id = v_participant_id AND training_id = v_training_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO questionnaire_besoins (
        participant_id, training_id, token, etat,
        email, prenom, nom, societe, woocommerce_product_id
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_product_id
      );
    END IF;

  ELSE -- 'evaluation'
    SELECT token INTO v_token
    FROM training_evaluations
    WHERE participant_id = v_participant_id AND training_id = v_training_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO training_evaluations (
        participant_id, training_id, token, etat,
        email, first_name, last_name, company, woocommerce_product_id
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_product_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END;
$$;

-- =============================================================================
-- 7. Function to create an orphan form entry for unknown participants
-- =============================================================================
CREATE OR REPLACE FUNCTION public.register_formulaire_orphan(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_product_id INT,
  p_form_type TEXT -- 'besoins' or 'evaluation'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_id UUID;
  v_token TEXT;
  v_existing_token TEXT;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR trim(p_first_name) = '' OR trim(p_last_name) = ''
     OR p_product_id IS NULL OR p_form_type IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  -- Verify product exists
  SELECT fc.id INTO v_catalog_id
  FROM formation_formulas ff
  JOIN formation_configs fc ON fc.id = ff.formation_config_id
  WHERE ff.woocommerce_product_id = p_product_id
  LIMIT 1;

  IF v_catalog_id IS NULL THEN
    SELECT id INTO v_catalog_id
    FROM formation_configs
    WHERE woocommerce_product_id = p_product_id
    LIMIT 1;
  END IF;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object('status', 'product_not_found');
  END IF;

  -- Check if an orphan entry already exists for this email + product
  IF p_form_type = 'besoins' THEN
    SELECT token INTO v_existing_token
    FROM questionnaire_besoins
    WHERE lower(email) = lower(p_email)
      AND woocommerce_product_id = p_product_id
      AND participant_id IS NULL;

    IF v_existing_token IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'token', v_existing_token);
    END IF;

    v_token := gen_random_uuid()::TEXT;
    INSERT INTO questionnaire_besoins (
      token, etat, email, prenom, nom, woocommerce_product_id
    ) VALUES (
      v_token, 'non_envoye', lower(p_email), trim(p_first_name), trim(p_last_name), p_product_id
    );

  ELSE -- 'evaluation'
    SELECT token INTO v_existing_token
    FROM training_evaluations
    WHERE lower(email) = lower(p_email)
      AND woocommerce_product_id = p_product_id
      AND participant_id IS NULL;

    IF v_existing_token IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'token', v_existing_token);
    END IF;

    v_token := gen_random_uuid()::TEXT;
    INSERT INTO training_evaluations (
      token, etat, email, first_name, last_name, woocommerce_product_id
    ) VALUES (
      v_token, 'non_envoye', lower(p_email), trim(p_first_name), trim(p_last_name), p_product_id
    );
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_formulaire_orphan(TEXT, TEXT, TEXT, INT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.register_formulaire_orphan(TEXT, TEXT, TEXT, INT, TEXT) TO authenticated;
