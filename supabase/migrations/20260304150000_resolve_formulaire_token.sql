-- Public function: resolve a questionnaire/evaluation token from email + WooCommerce product ID.
-- Called from the public redirect page (anon role).
-- Looks up participant, creates the form record if needed, returns the token.

CREATE OR REPLACE FUNCTION public.resolve_formulaire_token(
  p_email TEXT,
  p_product_id INT,
  p_form_type TEXT -- 'besoins' or 'evaluation'
) RETURNS TEXT
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
    RETURN NULL;
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN NULL;
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
    RETURN NULL;
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
    RETURN NULL;
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
        email, prenom, nom, societe
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name, v_participant.company
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
        email, first_name, last_name, company
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name, v_participant.company
      );
    END IF;
  END IF;

  RETURN v_token;
END;
$$;

-- Allow anon role to call this function (public redirect page, no auth)
GRANT EXECUTE ON FUNCTION public.resolve_formulaire_token(TEXT, INT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_formulaire_token(TEXT, INT, TEXT) TO authenticated;
