ALTER TABLE public.pictodico_words ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.pictodico_url_decode(t text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE r bytea := ''::bytea; i int := 1; n int; c text;
BEGIN
  IF t IS NULL OR t !~ '%[0-9A-Fa-f]{2}' THEN RETURN t; END IF;
  n := length(t);
  WHILE i <= n LOOP
    c := substr(t, i, 1);
    IF c = '%' AND substr(t, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' THEN
      r := r || decode(substr(t, i + 1, 2), 'hex'); i := i + 3;
    ELSE
      r := r || convert_to(c, 'UTF8'); i := i + 1;
    END IF;
  END LOOP;
  RETURN convert_from(r, 'UTF8');
EXCEPTION WHEN others THEN RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.pictodico_norm_key(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(lower(translate(public.pictodico_url_decode(coalesce(t, '')),
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.pictodico_register_request(
  p_word text, p_request_type text, p_source text,
  p_source_url text DEFAULT NULL, p_error_description text DEFAULT NULL,
  p_received_at timestamptz DEFAULT now())
RETURNS TABLE(id uuid, word text, request_type text, request_count integer, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_key text; v_id uuid;
BEGIN
  v_word := left(btrim(regexp_replace(public.pictodico_url_decode(coalesce(p_word, '')), '\s+', ' ', 'g')), 200);
  IF v_word = '' THEN RAISE EXCEPTION 'mot vide'; END IF;
  IF p_request_type NOT IN ('demande_ajout', 'erreur_signalee') THEN RAISE EXCEPTION 'request_type invalide'; END IF;
  v_key := public.pictodico_norm_key(v_word);
  PERFORM pg_advisory_xact_lock(hashtext('pictodico|' || p_request_type || '|' || v_key));

  SELECT w.id INTO v_id FROM public.pictodico_words w
   WHERE w.request_type = p_request_type AND public.pictodico_norm_key(w.word) = v_key
   ORDER BY w.is_chosen DESC, w.received_at ASC NULLS LAST LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.pictodico_words w
       SET request_count = w.request_count + 1,
           error_description = CASE WHEN coalesce(w.error_description, '') = '' THEN nullif(left(p_error_description, 2000), '') ELSE w.error_description END,
           source_url = coalesce(w.source_url, nullif(left(p_source_url, 1000), ''))
     WHERE w.id = v_id;
    RETURN QUERY SELECT w.id, w.word, w.request_type, w.request_count, false FROM public.pictodico_words w WHERE w.id = v_id;
  ELSE
    RETURN QUERY INSERT INTO public.pictodico_words AS w (word, language, source, request_type, source_url, error_description, received_at, request_count)
      VALUES (v_word, 'fr', p_source, p_request_type, nullif(left(p_source_url, 1000), ''), nullif(left(p_error_description, 2000), ''), coalesce(p_received_at, now()), 1)
      RETURNING w.id, w.word, w.request_type, w.request_count, true;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.pictodico_register_request(text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pictodico_register_request(text, text, text, text, text, timestamptz) TO service_role;