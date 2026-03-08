-- =============================================================
-- COMPREHENSIVE SECURITY HARDENING MIGRATION
-- =============================================================

-- 1. FIX POLICIES USING 'public' ROLE INSTEAD OF 'authenticated'

-- email_templates
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON public.email_templates;
CREATE POLICY "Authenticated users can view email templates" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update email templates" ON public.email_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete email templates" ON public.email_templates FOR DELETE TO authenticated USING (true);

-- evaluation_analyses
DROP POLICY IF EXISTS "Authenticated users can view analyses" ON public.evaluation_analyses;
DROP POLICY IF EXISTS "Authenticated users can create analyses" ON public.evaluation_analyses;
DROP POLICY IF EXISTS "Authenticated users can delete analyses" ON public.evaluation_analyses;
CREATE POLICY "Authenticated users can view analyses" ON public.evaluation_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create analyses" ON public.evaluation_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete analyses" ON public.evaluation_analyses FOR DELETE TO authenticated USING (true);

-- formation_dates
DROP POLICY IF EXISTS "Authenticated users can view formation dates" ON public.formation_dates;
DROP POLICY IF EXISTS "Authenticated users can insert formation dates" ON public.formation_dates;
DROP POLICY IF EXISTS "Authenticated users can update formation dates" ON public.formation_dates;
DROP POLICY IF EXISTS "Authenticated users can delete formation dates" ON public.formation_dates;
CREATE POLICY "Authenticated users can view formation dates" ON public.formation_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert formation dates" ON public.formation_dates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update formation dates" ON public.formation_dates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete formation dates" ON public.formation_dates FOR DELETE TO authenticated USING (true);

-- session_start_notifications
DROP POLICY IF EXISTS "Authenticated users can manage session notifications" ON public.session_start_notifications;
CREATE POLICY "Authenticated users can manage session notifications" ON public.session_start_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- improvements
DROP POLICY IF EXISTS "Authenticated users can view improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can insert improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can update improvements" ON public.improvements;
DROP POLICY IF EXISTS "Authenticated users can delete improvements" ON public.improvements;
CREATE POLICY "Authenticated users can view improvements" ON public.improvements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert improvements" ON public.improvements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update improvements" ON public.improvements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete improvements" ON public.improvements FOR DELETE TO authenticated USING (true);

-- activity_logs
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- login_attempts
DROP POLICY IF EXISTS "Service role can insert login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Service role can select login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Service role can delete login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 2. REMOVE ANON UPDATE ON SIGNATURE TABLES (edge functions handle writes)
DROP POLICY IF EXISTS "Public can update own signature via token" ON public.attendance_signatures;
DROP POLICY IF EXISTS "Public can update own devis signature via token" ON public.devis_signatures;
DROP POLICY IF EXISTS "Public can read convention signatures by token" ON public.convention_signatures;
DROP POLICY IF EXISTS "Public can view own signature via token" ON public.attendance_signatures;
DROP POLICY IF EXISTS "Public can view own devis signature via token" ON public.devis_signatures;

-- 3. REMOVE ANON DIRECT ACCESS ON TOKEN TABLES
DROP POLICY IF EXISTS "Public can view own questionnaire via token" ON public.questionnaire_besoins;
DROP POLICY IF EXISTS "Public can update own questionnaire via token" ON public.questionnaire_besoins;
DROP POLICY IF EXISTS "Public can view own evaluation via token" ON public.training_evaluations;
DROP POLICY IF EXISTS "Public can update own evaluation via token" ON public.training_evaluations;
DROP POLICY IF EXISTS "Public can view trainer evaluation via token" ON public.trainer_evaluations;
DROP POLICY IF EXISTS "Public can update trainer evaluation via token" ON public.trainer_evaluations;
DROP POLICY IF EXISTS "Public can view own reclamation via token" ON public.reclamations;
DROP POLICY IF EXISTS "Public can update own reclamation via token" ON public.reclamations;
DROP POLICY IF EXISTS "Public can view own sponsor evaluation via token" ON public.sponsor_cold_evaluations;
DROP POLICY IF EXISTS "Public can update own sponsor evaluation via token" ON public.sponsor_cold_evaluations;
DROP POLICY IF EXISTS "Public can view stakeholder appreciations" ON public.stakeholder_appreciations;
DROP POLICY IF EXISTS "Public can update stakeholder appreciations" ON public.stakeholder_appreciations;
DROP POLICY IF EXISTS "Public can view participant info" ON public.training_participants;
DROP POLICY IF EXISTS "Public can view training info via token" ON public.trainings;
DROP POLICY IF EXISTS "Public can view missions" ON public.missions;
DROP POLICY IF EXISTS "Public can view mission activities" ON public.mission_activities;
DROP POLICY IF EXISTS "Public can view mission documents" ON public.mission_documents;

-- 4. CREATE SECURE RPC FUNCTIONS FOR PUBLIC ACCESS

CREATE OR REPLACE FUNCTION public.get_questionnaire_by_token(p_token text)
RETURNS SETOF questionnaire_besoins LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM questionnaire_besoins WHERE token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.update_questionnaire_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM questionnaire_besoins WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE questionnaire_besoins SET
    prenom = COALESCE(p_data->>'prenom', prenom), nom = COALESCE(p_data->>'nom', nom),
    societe = COALESCE(p_data->>'societe', societe), fonction = COALESCE(p_data->>'fonction', fonction),
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
    date_consentement_rgpd = COALESCE(p_data->>'date_consentement_rgpd', date_consentement_rgpd),
    date_derniere_sauvegarde = COALESCE(p_data->>'date_derniere_sauvegarde', date_derniere_sauvegarde),
    date_premiere_ouverture = COALESCE(p_data->>'date_premiere_ouverture', date_premiere_ouverture),
    etat = COALESCE(p_data->>'etat', etat),
    date_soumission = COALESCE(p_data->>'date_soumission', date_soumission),
    necessite_validation_formateur = CASE WHEN p_data ? 'necessite_validation_formateur' THEN (p_data->>'necessite_validation_formateur')::boolean ELSE necessite_validation_formateur END
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_evaluation_by_token(p_token text)
RETURNS SETOF training_evaluations LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM training_evaluations WHERE token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.update_evaluation_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    date_soumission = COALESCE(p_data->>'date_soumission', date_soumission),
    date_premiere_ouverture = COALESCE(p_data->>'date_premiere_ouverture', date_premiere_ouverture)
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_trainer_evaluation_by_token(p_token text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  SELECT row_to_json(t) INTO v_result FROM (
    SELECT te.*, json_build_object('training_name', tr.training_name, 'start_date', tr.start_date, 'end_date', tr.end_date, 'location', tr.location) AS trainings
    FROM trainer_evaluations te LEFT JOIN trainings tr ON tr.id = te.training_id WHERE te.token = p_token LIMIT 1
  ) t;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.update_trainer_evaluation_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    date_submitted = COALESCE(p_data->>'date_submitted', date_submitted)
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_reclamation_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(r) FROM reclamations r WHERE r.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.update_reclamation_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    date_reclamation = COALESCE(p_data->>'date_reclamation', date_reclamation)
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_sponsor_evaluation_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(s) FROM sponsor_cold_evaluations s WHERE s.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.update_sponsor_evaluation_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    date_soumission = COALESCE(p_data->>'date_soumission', date_soumission),
    date_premiere_ouverture = COALESCE(p_data->>'date_premiere_ouverture', date_premiere_ouverture)
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_stakeholder_appreciation_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(s) FROM stakeholder_appreciations s WHERE s.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.update_stakeholder_appreciation_by_token(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM stakeholder_appreciations WHERE token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE stakeholder_appreciations SET
    satisfaction_globale = CASE WHEN p_data ? 'satisfaction_globale' THEN (p_data->>'satisfaction_globale')::int ELSE satisfaction_globale END,
    points_forts = COALESCE(p_data->>'points_forts', points_forts),
    axes_amelioration = COALESCE(p_data->>'axes_amelioration', axes_amelioration),
    commentaires = COALESCE(p_data->>'commentaires', commentaires),
    status = COALESCE(p_data->>'status', status),
    date_reception = CASE WHEN p_data ? 'date_reception' THEN (p_data->>'date_reception')::timestamptz ELSE date_reception END
  WHERE id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_attendance_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(a) FROM attendance_signatures a WHERE a.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_convention_signature_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(c) FROM convention_signatures c WHERE c.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_devis_signature_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(d) FROM devis_signatures d WHERE d.token = p_token LIMIT 1; $$;

-- Helper functions for public forms
CREATE OR REPLACE FUNCTION public.get_training_public_info(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('training_name', training_name, 'start_date', start_date, 'end_date', end_date, 'prerequisites', prerequisites, 'program_file_url', program_file_url, 'format_formation', format_formation, 'location', location, 'objectives', objectives, 'session_type', session_type)
  FROM trainings WHERE id = p_training_id;
$$;

CREATE OR REPLACE FUNCTION public.get_participant_public_info(p_participant_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('first_name', first_name, 'last_name', last_name, 'email', email) FROM training_participants WHERE id = p_participant_id;
$$;

CREATE OR REPLACE FUNCTION public.get_training_schedules_public(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('day_date', day_date, 'start_time', start_time, 'end_time', end_time) ORDER BY day_date), '[]'::json) FROM training_schedules WHERE training_id = p_training_id;
$$;

CREATE OR REPLACE FUNCTION public.get_training_participants_list(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('first_name', first_name, 'last_name', last_name) ORDER BY last_name), '[]'::json) FROM training_participants WHERE training_id = p_training_id;
$$;

CREATE OR REPLACE FUNCTION public.get_previous_trainer_evaluations(p_trainer_email text, p_exclude_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('points_forts', points_forts, 'axes_amelioration', axes_amelioration, 'commentaires', commentaires)), '[]'::json)
  FROM trainer_evaluations WHERE trainer_email = p_trainer_email AND status = 'soumis' AND id != p_exclude_id;
$$;

-- Mission public summary functions
CREATE OR REPLACE FUNCTION public.get_mission_public_summary(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('id', id, 'title', title, 'description', description, 'client_name', client_name, 'status', status, 'start_date', start_date, 'end_date', end_date, 'initial_amount', initial_amount, 'daily_rate', daily_rate, 'total_days', total_days, 'emoji', emoji)
  FROM missions WHERE id = p_mission_id;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_activities_public(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('id', id, 'description', description, 'activity_date', activity_date, 'duration_type', duration_type, 'duration', duration, 'billable_amount', billable_amount, 'invoice_url', invoice_url, 'invoice_number', invoice_number, 'is_billed', is_billed, 'notes', notes) ORDER BY activity_date), '[]'::json) FROM mission_activities WHERE mission_id = p_mission_id;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_documents_public(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('id', id, 'file_name', file_name, 'file_url', file_url, 'file_size', file_size, 'is_deliverable', is_deliverable) ORDER BY created_at), '[]'::json) FROM mission_documents WHERE mission_id = p_mission_id;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_actions_public(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('id', id, 'title', title, 'status', status, 'position', position) ORDER BY position), '[]'::json) FROM mission_actions WHERE mission_id = p_mission_id;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_media_public(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object('id', id, 'file_name', file_name, 'file_url', file_url, 'file_size', file_size, 'file_type', file_type, 'is_deliverable', is_deliverable) ORDER BY created_at), '[]'::json) FROM media WHERE source_type = 'mission' AND source_id = p_mission_id;
$$;

CREATE OR REPLACE FUNCTION public.insert_questionnaire_event(p_questionnaire_id uuid, p_type_evenement text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO questionnaire_events (questionnaire_id, type_evenement, metadata) VALUES (p_questionnaire_id, p_type_evenement, p_metadata); END; $$;

CREATE OR REPLACE FUNCTION public.update_participant_after_questionnaire(p_token text, p_company text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_participant_id uuid;
BEGIN
  SELECT participant_id INTO v_participant_id FROM questionnaire_besoins WHERE token = p_token;
  IF v_participant_id IS NOT NULL THEN
    UPDATE training_participants SET needs_survey_status = 'complete', company = COALESCE(p_company, company) WHERE id = v_participant_id;
  END IF;
END; $$;

-- 5. ENABLE RLS ON formulaire_rate_limits
ALTER TABLE public.formulaire_rate_limits ENABLE ROW LEVEL SECURITY;

-- 6. FIX FUNCTION SEARCH_PATH
CREATE OR REPLACE FUNCTION public.set_default_assigned_to()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := auth.uid(); END IF;
  RETURN NEW;
END; $$;