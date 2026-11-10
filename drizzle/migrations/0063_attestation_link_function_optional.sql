CREATE OR REPLACE FUNCTION public.generate_execution_attestation_link(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE a public.execution_attestations; tok text; exp timestamptz;
BEGIN
  SELECT * INTO a FROM public.execution_attestations WHERE id = p_id;
  IF NOT FOUND OR NOT public.can_access_attestation_source(a.source_type) THEN RAISE EXCEPTION 'Attestation introuvable'; END IF;
  IF a.status IN ('signed','cancelled') THEN RAISE EXCEPTION 'Attestation % : lien impossible', a.status; END IF;
  IF coalesce(trim(a.subject),'') = '' OR coalesce(trim(a.client_name),'') = '' THEN RAISE EXCEPTION 'Objet et client requis'; END IF;
  -- La fonction du signataire peut être complétée par lui sur la page de signature (obligatoire à la signature).
  IF a.is_public_entity AND (coalesce(trim(a.public_entity_name),'') = '' OR coalesce(trim(a.signer_name),'') = '') THEN
    RAISE EXCEPTION 'Collectivité territoriale : nom de la collectivité et nom du signataire requis';
  END IF;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  exp := now() + make_interval(days => greatest(1, a.link_validity_days));
  UPDATE public.execution_attestations SET token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'),
    status = 'sent', sent_at = now(), expires_at = exp, refused_at = NULL, refusal_reason = NULL, updated_by = auth.uid()
  WHERE id = p_id;
  RETURN jsonb_build_object('token', tok, 'expires_at', exp);
END $$;