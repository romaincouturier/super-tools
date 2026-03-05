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
  v_formula_id UUID;
  v_participant RECORD;
  v_token TEXT;
BEGIN
  IF p_email IS NULL OR p_course_id IS NULL OR p_form_type IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  IF p_form_type NOT IN ('besoins', 'evaluation') THEN
    RETURN jsonb_build_object('status', 'invalid_params');
  END IF;

  -- Formula-level lookup first (strictest match)
  SELECT ff.id, fc.id
  INTO v_formula_id, v_catalog_id
  FROM public.formation_formulas ff
  JOIN public.formation_configs fc ON fc.id = ff.formation_config_id
  WHERE ff.learndash_course_id = p_course_id
  LIMIT 1;

  -- Fallback for catalog-level course mapping
  IF v_catalog_id IS NULL THEN
    SELECT fc.id
    INTO v_catalog_id
    FROM public.formation_configs fc
    WHERE fc.learndash_course_id = p_course_id
    LIMIT 1;
  END IF;

  IF v_catalog_id IS NULL THEN
    RETURN jsonb_build_object('status', 'product_not_found');
  END IF;

  -- Participant resolution: strict formula match when formula is known
  IF v_formula_id IS NOT NULL THEN
    SELECT tp.id, tp.training_id, tp.first_name, tp.last_name, tp.company, tp.email
    INTO v_participant
    FROM public.training_participants tp
    JOIN public.trainings t ON t.id = tp.training_id
    WHERE lower(tp.email) = lower(p_email)
      AND t.catalog_id = v_catalog_id
      AND tp.formula_id = v_formula_id
    ORDER BY tp.added_at DESC
    LIMIT 1;
  ELSE
    SELECT tp.id, tp.training_id, tp.first_name, tp.last_name, tp.company, tp.email
    INTO v_participant
    FROM public.training_participants tp
    JOIN public.trainings t ON t.id = tp.training_id
    WHERE lower(tp.email) = lower(p_email)
      AND t.catalog_id = v_catalog_id
    ORDER BY tp.added_at DESC
    LIMIT 1;
  END IF;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'participant_not_found',
      'catalog_id', v_catalog_id
    );
  END IF;

  IF p_form_type = 'besoins' THEN
    SELECT token INTO v_token
    FROM public.questionnaire_besoins
    WHERE participant_id = v_participant.id
      AND training_id = v_participant.training_id
      AND learndash_course_id = p_course_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO public.questionnaire_besoins (
        participant_id, training_id, token, etat,
        email, prenom, nom, societe, learndash_course_id
      ) VALUES (
        v_participant.id, v_participant.training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_course_id
      );
    END IF;
  ELSE
    SELECT token INTO v_token
    FROM public.training_evaluations
    WHERE participant_id = v_participant.id
      AND training_id = v_participant.training_id
      AND learndash_course_id = p_course_id;

    IF v_token IS NULL THEN
      v_token := gen_random_uuid()::TEXT;
      INSERT INTO public.training_evaluations (
        participant_id, training_id, token, etat,
        email, first_name, last_name, company, learndash_course_id
      ) VALUES (
        v_participant.id, v_participant.training_id, v_token, 'non_envoye',
        v_participant.email, v_participant.first_name, v_participant.last_name,
        v_participant.company, p_course_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'token', v_token);
END;
$$;