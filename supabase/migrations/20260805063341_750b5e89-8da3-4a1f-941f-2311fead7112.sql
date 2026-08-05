CREATE OR REPLACE FUNCTION public.update_sponsor_evaluation_by_token(p_token text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM sponsor_cold_evaluations WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE sponsor_cold_evaluations SET
    satisfaction_globale = CASE WHEN p_data ? 'satisfaction_globale' THEN (p_data->>'satisfaction_globale')::int ELSE satisfaction_globale END,
    attentes_satisfaites = COALESCE(p_data->>'attentes_satisfaites', attentes_satisfaites),
    objectifs_atteints = COALESCE(p_data->>'objectifs_atteints', objectifs_atteints),
    impact_competences = COALESCE(p_data->>'impact_competences', impact_competences),
    description_impact = COALESCE(p_data->>'description_impact', description_impact),
    organisation_satisfaisante = CASE WHEN p_data ? 'organisation_satisfaisante' THEN (p_data->>'organisation_satisfaisante')::boolean ELSE organisation_satisfaisante END,
    communication_satisfaisante = CASE WHEN p_data ? 'communication_satisfaisante' THEN (p_data->>'communication_satisfaisante')::boolean ELSE communication_satisfaisante END,
    recommandation = COALESCE(p_data->>'recommandation', recommandation),
    message_recommandation = COALESCE(p_data->>'message_recommandation', message_recommandation),
    consent_publication = CASE WHEN p_data ? 'consent_publication' THEN (p_data->>'consent_publication')::boolean ELSE consent_publication END,
    points_forts = COALESCE(p_data->>'points_forts', points_forts),
    axes_amelioration = COALESCE(p_data->>'axes_amelioration', axes_amelioration),
    commentaires_libres = COALESCE(p_data->>'commentaires_libres', commentaires_libres),
    etat = COALESCE(p_data->>'etat', etat),
    date_soumission = CASE WHEN p_data ? 'date_soumission' THEN (p_data->>'date_soumission')::timestamptz ELSE date_soumission END,
    date_premiere_ouverture = CASE WHEN p_data ? 'date_premiere_ouverture' THEN (p_data->>'date_premiere_ouverture')::timestamptz ELSE date_premiere_ouverture END
  WHERE id = v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_reclamation_by_token(p_token text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM reclamations WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE reclamations SET
    client_name = COALESCE(p_data->>'client_name', client_name),
    client_email = COALESCE(p_data->>'client_email', client_email),
    canal = COALESCE(p_data->>'canal', canal),
    nature = COALESCE(p_data->>'nature', nature),
    problem_type = COALESCE(p_data->>'problem_type', problem_type),
    attendu_initial = COALESCE(p_data->>'attendu_initial', attendu_initial),
    resultat_constate = COALESCE(p_data->>'resultat_constate', resultat_constate),
    description = COALESCE(p_data->>'description', description),
    severity = COALESCE(p_data->>'severity', severity),
    status = COALESCE(p_data->>'status', status),
    date_reclamation = CASE WHEN p_data ? 'date_reclamation' THEN (p_data->>'date_reclamation')::date ELSE date_reclamation END
  WHERE id = v_id;
END; $function$;