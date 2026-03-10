CREATE OR REPLACE FUNCTION public.update_questionnaire_by_token(p_token text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM questionnaire_besoins WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE questionnaire_besoins SET
    prenom = COALESCE(p_data->>'prenom', prenom),
    nom = COALESCE(p_data->>'nom', nom),
    societe = COALESCE(p_data->>'societe', societe),
    fonction = COALESCE(p_data->>'fonction', fonction),
    experience_sujet = COALESCE(p_data->>'experience_sujet', experience_sujet),
    experience_details = COALESCE(p_data->>'experience_details', experience_details),
    lecture_programme = COALESCE(p_data->>'lecture_programme', lecture_programme),
    prerequis_validation = COALESCE(p_data->>'prerequis_validation', prerequis_validation),
    prerequis_details = COALESCE(p_data->>'prerequis_details', prerequis_details),
    competences_actuelles = COALESCE(p_data->>'competences_actuelles', competences_actuelles),
    competences_visees = COALESCE(p_data->>'competences_visees', competences_visees),
    lien_mission = COALESCE(p_data->>'lien_mission', lien_mission),
    niveau_actuel = CASE WHEN p_data ? 'niveau_actuel' THEN (p_data->>'niveau_actuel')::int ELSE niveau_actuel END,
    niveau_motivation = CASE WHEN p_data ? 'niveau_motivation' THEN (p_data->>'niveau_motivation')::int ELSE niveau_motivation END,
    modalites_preferences = CASE WHEN p_data ? 'modalites_preferences' THEN (p_data->'modalites_preferences') ELSE modalites_preferences END,
    contraintes_orga = COALESCE(p_data->>'contraintes_orga', contraintes_orga),
    besoins_accessibilite = COALESCE(p_data->>'besoins_accessibilite', besoins_accessibilite),
    necessite_amenagement = CASE WHEN p_data ? 'necessite_amenagement' THEN (p_data->>'necessite_amenagement')::boolean ELSE necessite_amenagement END,
    commentaires_libres = COALESCE(p_data->>'commentaires_libres', commentaires_libres),
    consentement_rgpd = CASE WHEN p_data ? 'consentement_rgpd' THEN (p_data->>'consentement_rgpd')::boolean ELSE consentement_rgpd END,
    date_consentement_rgpd = CASE WHEN p_data ? 'date_consentement_rgpd' THEN (p_data->>'date_consentement_rgpd')::timestamptz ELSE date_consentement_rgpd END,
    date_derniere_sauvegarde = CASE WHEN p_data ? 'date_derniere_sauvegarde' THEN (p_data->>'date_derniere_sauvegarde')::timestamptz ELSE date_derniere_sauvegarde END,
    date_premiere_ouverture = CASE WHEN p_data ? 'date_premiere_ouverture' THEN (p_data->>'date_premiere_ouverture')::timestamptz ELSE date_premiere_ouverture END,
    etat = COALESCE(p_data->>'etat', etat),
    date_soumission = CASE WHEN p_data ? 'date_soumission' THEN (p_data->>'date_soumission')::timestamptz ELSE date_soumission END,
    necessite_validation_formateur = CASE WHEN p_data ? 'necessite_validation_formateur' THEN (p_data->>'necessite_validation_formateur')::boolean ELSE necessite_validation_formateur END
  WHERE id = v_id;
END;
$function$