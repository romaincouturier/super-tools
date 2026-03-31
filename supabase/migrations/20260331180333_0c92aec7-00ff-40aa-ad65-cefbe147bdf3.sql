
CREATE OR REPLACE FUNCTION public.update_trainer_evaluation_by_token(p_token text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM trainer_evaluations WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE trainer_evaluations SET
    satisfaction_globale = CASE WHEN p_data ? 'satisfaction_globale' THEN (p_data->>'satisfaction_globale')::int ELSE satisfaction_globale END,
    points_forts = COALESCE(p_data->>'points_forts', points_forts),
    axes_amelioration = COALESCE(p_data->>'axes_amelioration', axes_amelioration),
    commentaires = COALESCE(p_data->>'commentaires', commentaires),
    status = COALESCE(p_data->>'status', status),
    date_submitted = CASE WHEN p_data ? 'date_submitted' THEN (p_data->>'date_submitted')::timestamptz ELSE date_submitted END
  WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_evaluation_by_token(p_token text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM training_evaluations WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE training_evaluations SET
    appreciation_generale = CASE WHEN p_data ? 'appreciation_generale' THEN (p_data->>'appreciation_generale')::int ELSE appreciation_generale END,
    recommandation = COALESCE(p_data->>'recommandation', recommandation),
    objectifs_evaluation = CASE WHEN p_data ? 'objectifs_evaluation' THEN (p_data->'objectifs_evaluation') ELSE objectifs_evaluation END,
    objectif_prioritaire = COALESCE(p_data->>'objectif_prioritaire', objectif_prioritaire),
    delai_application = COALESCE(p_data->>'delai_application', delai_application),
    freins_application = COALESCE(p_data->>'freins_application', freins_application),
    rythme = COALESCE(p_data->>'rythme', rythme),
    equilibre_theorie_pratique = COALESCE(p_data->>'equilibre_theorie_pratique', equilibre_theorie_pratique),
    amelioration_suggeree = COALESCE(p_data->>'amelioration_suggeree', amelioration_suggeree),
    conditions_info_satisfaisantes = CASE WHEN p_data ? 'conditions_info_satisfaisantes' THEN (p_data->>'conditions_info_satisfaisantes')::boolean ELSE conditions_info_satisfaisantes END,
    formation_adaptee_public = CASE WHEN p_data ? 'formation_adaptee_public' THEN (p_data->>'formation_adaptee_public')::boolean ELSE formation_adaptee_public END,
    qualification_intervenant_adequate = CASE WHEN p_data ? 'qualification_intervenant_adequate' THEN (p_data->>'qualification_intervenant_adequate')::boolean ELSE qualification_intervenant_adequate END,
    appreciations_prises_en_compte = COALESCE(p_data->>'appreciations_prises_en_compte', appreciations_prises_en_compte),
    message_recommandation = COALESCE(p_data->>'message_recommandation', message_recommandation),
    consent_publication = CASE WHEN p_data ? 'consent_publication' THEN (p_data->>'consent_publication')::boolean ELSE consent_publication END,
    remarques_libres = COALESCE(p_data->>'remarques_libres', remarques_libres),
    etat = COALESCE(p_data->>'etat', etat),
    date_soumission = CASE WHEN p_data ? 'date_soumission' THEN (p_data->>'date_soumission')::timestamptz ELSE date_soumission END,
    date_premiere_ouverture = CASE WHEN p_data ? 'date_premiere_ouverture' THEN (p_data->>'date_premiere_ouverture')::timestamptz ELSE date_premiere_ouverture END
  WHERE id = v_id;
END;
$$;
