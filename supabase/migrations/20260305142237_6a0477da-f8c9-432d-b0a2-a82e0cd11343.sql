-- Update resolve_formulaire_token to write learndash_course_id instead of woocommerce_product_id
CREATE OR REPLACE FUNCTION public.resolve_formulaire_token(
  p_email TEXT,
  p_course_id INT,
  p_form_type TEXT
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
  IF p_email IS NULL OR p_course_id IS NULL OR p_form_type IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  SELECT fc.id INTO v_catalog_id
  FROM formation_formulas ff
  JOIN formation_configs fc ON fc.id = ff.formation_config_id
  WHERE ff.learndash_course_id = p_course_id
  LIMIT 1;

  IF v_catalog_id IS NULL THEN
    SELECT id INTO v_catalog_id
    FROM formation_configs
    WHERE learndash_course_id = p_course_id
    LIMIT 1;
  END IF;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object('status', 'product_not_found');
  END IF;

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

  IF p_form_type = 'besoins' THEN
    SELECT token INTO v_token
    FROM questionnaire_besoins
    WHERE participant_id = v_participant_id AND training_id = v_training_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO questionnaire_besoins (
        participant_id, training_id, token, etat,
        email, prenom, nom, societe, learndash_course_id
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_course_id
      );
    END IF;
  ELSE
    SELECT token INTO v_token
    FROM training_evaluations
    WHERE participant_id = v_participant_id AND training_id = v_training_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO training_evaluations (
        participant_id, training_id, token, etat,
        email, first_name, last_name, company, learndash_course_id
      ) VALUES (
        v_participant_id, v_training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_course_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END;
$$;

-- Update register_formulaire_orphan to write learndash_course_id instead of woocommerce_product_id
CREATE OR REPLACE FUNCTION public.register_formulaire_orphan(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_course_id INT,
  p_form_type TEXT
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
  IF p_email IS NULL OR trim(p_first_name) = '' OR trim(p_last_name) = ''
     OR p_course_id IS NULL OR p_form_type IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  SELECT fc.id INTO v_catalog_id
  FROM formation_formulas ff
  JOIN formation_configs fc ON fc.id = ff.formation_config_id
  WHERE ff.learndash_course_id = p_course_id
  LIMIT 1;

  IF v_catalog_id IS NULL THEN
    SELECT id INTO v_catalog_id
    FROM formation_configs
    WHERE learndash_course_id = p_course_id
    LIMIT 1;
  END IF;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object('status', 'product_not_found');
  END IF;

  IF p_form_type = 'besoins' THEN
    SELECT token INTO v_existing_token
    FROM questionnaire_besoins
    WHERE lower(email) = lower(p_email)
      AND learndash_course_id = p_course_id
      AND participant_id IS NULL;

    IF v_existing_token IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'token', v_existing_token);
    END IF;

    v_token := gen_random_uuid()::TEXT;
    INSERT INTO questionnaire_besoins (
      token, etat, email, prenom, nom, learndash_course_id
    ) VALUES (
      v_token, 'non_envoye', lower(p_email), trim(p_first_name), trim(p_last_name), p_course_id
    );
  ELSE
    SELECT token INTO v_existing_token
    FROM training_evaluations
    WHERE lower(email) = lower(p_email)
      AND learndash_course_id = p_course_id
      AND participant_id IS NULL;

    IF v_existing_token IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'token', v_existing_token);
    END IF;

    v_token := gen_random_uuid()::TEXT;
    INSERT INTO training_evaluations (
      token, etat, email, first_name, last_name, learndash_course_id
    ) VALUES (
      v_token, 'non_envoye', lower(p_email), trim(p_first_name), trim(p_last_name), p_course_id
    );
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END;
$$;