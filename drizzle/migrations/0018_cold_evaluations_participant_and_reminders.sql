ALTER TABLE public.scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;
ALTER TABLE public.scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check CHECK (email_type = ANY (ARRAY['welcome','needs_survey','needs_survey_reminder','evaluation_reminder','evaluation_reminder_1','evaluation_reminder_2','training_documents','thank_you','calendar_invite','elearning_access','certificate','accessibility_needs','prerequis_warning','convention_email','convention_reminder','trainer_summary','google_review','video_testimonial','cold_evaluation','cold_evaluation_reminder','participant_cold_evaluation','participant_cold_evaluation_reminder','funder_reminder','participant_list_reminder','live_reminder','coaching_reminder','coaching_booking_invite','follow_up_news']::text[]));

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_emails_cold_pending_unique
  ON public.scheduled_emails (training_id, email_type, COALESCE(participant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending' AND email_type IN ('cold_evaluation','cold_evaluation_reminder','participant_cold_evaluation','participant_cold_evaluation_reminder');

ALTER TABLE public.sponsor_cold_evaluations ADD COLUMN IF NOT EXISTS date_relance timestamptz;

CREATE TABLE public.participant_cold_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.training_participants(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  etat text NOT NULL DEFAULT 'envoye' CHECK (etat IN ('envoye','ouvert','soumis')),
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  training_name text,
  training_start_date date,
  training_end_date date,
  mise_en_pratique text CHECK (mise_en_pratique IN ('oui','partiellement','non')),
  frequence_utilisation text CHECK (frequence_utilisation IN ('quotidienne','hebdomadaire','ponctuelle','jamais')),
  exemple_application text,
  niveau_maitrise integer CHECK (niveau_maitrise BETWEEN 1 AND 5),
  freins text[] NOT NULL DEFAULT '{}',
  freins_details text,
  effets_constates text,
  objectifs_atteints text CHECK (objectifs_atteints IN ('oui','partiellement','non')),
  besoins_complementaires text[] NOT NULL DEFAULT '{}',
  recommandation text CHECK (recommandation IN ('oui','non','peut_etre')),
  temoignage text,
  consent_publication boolean,
  commentaires_libres text,
  date_envoi timestamptz,
  date_premiere_ouverture timestamptz,
  date_relance timestamptz,
  date_soumission timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_participant_cold_evaluations_training ON public.participant_cold_evaluations(training_id);
CREATE INDEX idx_participant_cold_evaluations_participant ON public.participant_cold_evaluations(participant_id);

GRANT SELECT, UPDATE ON public.participant_cold_evaluations TO authenticated;
GRANT ALL ON public.participant_cold_evaluations TO service_role;
ALTER TABLE public.participant_cold_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Formations staff read participant cold evaluations" ON public.participant_cold_evaluations
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));
CREATE POLICY "Formations staff update participant cold evaluations" ON public.participant_cold_evaluations
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations') OR public.has_module_access(auth.uid(), 'evaluations'));

CREATE TRIGGER trg_participant_cold_evaluations_updated_at BEFORE UPDATE ON public.participant_cold_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_participant_cold_evaluation_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'token', e.token, 'etat', e.etat, 'first_name', e.first_name, 'company', e.company,
    'training_name', e.training_name, 'training_start_date', e.training_start_date, 'training_end_date', e.training_end_date,
    'mise_en_pratique', e.mise_en_pratique, 'frequence_utilisation', e.frequence_utilisation, 'exemple_application', e.exemple_application,
    'niveau_maitrise', e.niveau_maitrise, 'freins', e.freins, 'freins_details', e.freins_details, 'effets_constates', e.effets_constates,
    'objectifs_atteints', e.objectifs_atteints, 'besoins_complementaires', e.besoins_complementaires, 'recommandation', e.recommandation,
    'temoignage', e.temoignage, 'consent_publication', e.consent_publication, 'commentaires_libres', e.commentaires_libres,
    'date_soumission', e.date_soumission)
  FROM participant_cold_evaluations e WHERE e.token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mark_participant_cold_evaluation_opened(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE participant_cold_evaluations
     SET date_premiere_ouverture = COALESCE(date_premiere_ouverture, now()),
         etat = CASE WHEN etat = 'envoye' THEN 'ouvert' ELSE etat END
   WHERE token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.submit_participant_cold_evaluation(p_token text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM participant_cold_evaluations WHERE token = p_token AND etat <> 'soumis';
  IF v_id IS NULL THEN RAISE EXCEPTION 'not found or already submitted'; END IF;
  UPDATE participant_cold_evaluations SET
    mise_en_pratique = NULLIF(p_data->>'mise_en_pratique',''),
    frequence_utilisation = NULLIF(p_data->>'frequence_utilisation',''),
    exemple_application = left(NULLIF(p_data->>'exemple_application',''), 5000),
    niveau_maitrise = NULLIF(p_data->>'niveau_maitrise','')::int,
    freins = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'freins','[]'::jsonb))), '{}'),
    freins_details = left(NULLIF(p_data->>'freins_details',''), 5000),
    effets_constates = left(NULLIF(p_data->>'effets_constates',''), 5000),
    objectifs_atteints = NULLIF(p_data->>'objectifs_atteints',''),
    besoins_complementaires = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'besoins_complementaires','[]'::jsonb))), '{}'),
    recommandation = NULLIF(p_data->>'recommandation',''),
    temoignage = left(NULLIF(p_data->>'temoignage',''), 5000),
    consent_publication = CASE WHEN p_data ? 'consent_publication' THEN (p_data->>'consent_publication')::boolean ELSE NULL END,
    commentaires_libres = left(NULLIF(p_data->>'commentaires_libres',''), 5000),
    etat = 'soumis',
    date_soumission = now()
  WHERE id = v_id;
END; $$;

REVOKE ALL ON FUNCTION public.get_participant_cold_evaluation_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_participant_cold_evaluation_opened(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_participant_cold_evaluation(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_participant_cold_evaluation_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_participant_cold_evaluation_opened(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_participant_cold_evaluation(text, jsonb) TO anon, authenticated, service_role;