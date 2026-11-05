CREATE OR REPLACE FUNCTION public.save_training_regulation_draft(p_content text, p_expected text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_content text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('training_regulation'));
  SELECT setting_value INTO current_content FROM public.app_settings WHERE setting_key = 'reglement_interieur_draft';
  IF coalesce(current_content, '') IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Le brouillon a été modifié ailleurs. Rechargez la page.'; END IF;
  INSERT INTO public.app_settings(setting_key, setting_value, description) VALUES ('reglement_interieur_draft', p_content, 'Brouillon Markdown du règlement intérieur')
  ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_training_regulation_draft(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_training_regulation_draft(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_training_regulation(p_content text, p_url text, p_expected_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_url text; history jsonb; entry jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501'; END IF;
  IF length(trim(p_content)) = 0 THEN RAISE EXCEPTION 'Le règlement est vide'; END IF;
  IF p_url !~ '^https://[^/]+/storage/v1/object/public/training-documents/reglement-interieur/[^/]+\.pdf$' THEN RAISE EXCEPTION 'URL PDF invalide'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('training_regulation'));
  SELECT setting_value INTO current_url FROM public.app_settings WHERE setting_key = 'reglement_interieur_url';
  IF coalesce(current_url, '') IS DISTINCT FROM p_expected_url THEN RAISE EXCEPTION 'Une nouvelle version a été publiée. Rechargez la page.'; END IF;
  IF p_content IS DISTINCT FROM (SELECT setting_value FROM public.app_settings WHERE setting_key = 'reglement_interieur_draft') THEN RAISE EXCEPTION 'Enregistrez le brouillon avant publication'; END IF;
  SELECT setting_value::jsonb INTO history FROM public.app_settings WHERE setting_key = 'reglement_interieur_versions';
  history := coalesce(history, '[]'::jsonb);
  IF jsonb_array_length(history) = 0 AND coalesce(current_url,'') <> '' THEN
    history := history || jsonb_build_array(jsonb_build_object('id','legacy','url',current_url,'published_at',null,'content',null,'label','PDF précédent'));
  END IF;
  entry := jsonb_build_object('id',gen_random_uuid(),'url',p_url,'content',p_content,'published_at',now(),'published_by',auth.uid());
  history := history || jsonb_build_array(entry);
  INSERT INTO public.app_settings(setting_key,setting_value,description) VALUES ('reglement_interieur_versions',history::text,'Historique des versions publiées du règlement intérieur')
  ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = now();
  INSERT INTO public.app_settings(setting_key,setting_value,description) VALUES ('reglement_interieur_url',p_url,'URL du règlement intérieur publié')
  ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = now();
  RETURN entry;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_training_regulation(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_training_regulation(text,text,text) TO authenticated;