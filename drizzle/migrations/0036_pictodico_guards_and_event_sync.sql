-- Un mot Picto-Dico valide : 1 à 60 caractères, lettres/chiffres, espaces, apostrophes, tirets ; ni URL ni signalement.
CREATE OR REPLACE FUNCTION public.pictodico_word_is_valid(p_word text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT w IS NOT NULL
    AND char_length(w) BETWEEN 1 AND 60
    AND w ~ '^[[:alnum:]][[:alnum:] ''’-]*$'
    AND w !~* '(https?|www|erreur signal|url du mot)'
    AND char_length(w) - char_length(replace(replace(w, '''', ''), '’', '')) <= 2
  FROM (SELECT btrim(p_word) AS w) s
$$;

-- Texte libre (commentaire de signalement) : borné, sans chevrons ni rafales de quotes/parenthèses.
CREATE OR REPLACE FUNCTION public.pictodico_text_is_safe(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_text IS NULL OR (
    char_length(p_text) <= 500
    AND p_text !~ '[<>{}`\\]'
    AND p_text !~ '[''"();]{3,}'
    AND p_text !~ '\(\(|\)\)'
  )
$$;

CREATE OR REPLACE FUNCTION public.pictodico_register_request(p_word text, p_request_type text, p_source text, p_source_url text DEFAULT NULL::text, p_error_description text DEFAULT NULL::text, p_received_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(id uuid, word text, request_type text, request_count integer, created boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_word text; v_key text; v_id uuid;
BEGIN
  v_word := left(btrim(regexp_replace(public.pictodico_url_decode(coalesce(p_word, '')), '\s+', ' ', 'g')), 200);
  IF v_word = '' THEN RAISE EXCEPTION 'mot vide'; END IF;
  IF p_request_type NOT IN ('demande_ajout', 'erreur_signalee') THEN RAISE EXCEPTION 'request_type invalide'; END IF;
  IF NOT public.pictodico_word_is_valid(v_word) THEN RAISE EXCEPTION 'saisie invalide' USING ERRCODE = '22023'; END IF;
  IF NOT public.pictodico_text_is_safe(p_error_description) THEN RAISE EXCEPTION 'commentaire invalide' USING ERRCODE = '22023'; END IF;
  v_key := public.pictodico_norm_key(v_word);
  PERFORM pg_advisory_xact_lock(hashtext('pictodico|' || p_request_type || '|' || v_key));

  SELECT w.id INTO v_id FROM public.pictodico_words w
   WHERE w.request_type = p_request_type AND public.pictodico_norm_key(w.word) = v_key
   ORDER BY w.is_chosen DESC, w.received_at ASC NULLS LAST LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.pictodico_words w
       SET request_count = w.request_count + 1,
           error_description = CASE WHEN coalesce(w.error_description, '') = '' THEN nullif(left(p_error_description, 500), '') ELSE w.error_description END,
           source_url = coalesce(w.source_url, nullif(left(p_source_url, 1000), ''))
     WHERE w.id = v_id;
    RETURN QUERY SELECT w.id, w.word, w.request_type, w.request_count, false FROM public.pictodico_words w WHERE w.id = v_id;
  ELSE
    RETURN QUERY INSERT INTO public.pictodico_words AS w (word, language, source, request_type, source_url, error_description, received_at, request_count)
      VALUES (v_word, 'fr', p_source, p_request_type, nullif(left(p_source_url, 1000), ''), nullif(left(p_error_description, 500), ''), coalesce(p_received_at, now()), 1)
      RETURNING w.id, w.word, w.request_type, w.request_count, true;
  END IF;
END $function$;

-- Toute écriture de mot (import manuel, MCP, webhook) passe la validation.
CREATE OR REPLACE FUNCTION public.pictodico_words_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.pictodico_word_is_valid(NEW.word) THEN
    RAISE EXCEPTION 'Mot invalide : « % » (60 caractères max, lettres, chiffres, espaces, apostrophes et tirets uniquement)', left(NEW.word, 60) USING ERRCODE = '22023';
  END IF;
  IF NOT public.pictodico_text_is_safe(NEW.error_description) AND (TG_OP = 'INSERT' OR NEW.error_description IS DISTINCT FROM OLD.error_description) THEN
    RAISE EXCEPTION 'Commentaire invalide' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pictodico_words_validate ON public.pictodico_words;
CREATE TRIGGER trg_pictodico_words_validate BEFORE INSERT OR UPDATE OF word, error_description ON public.pictodico_words
  FOR EACH ROW EXECUTE FUNCTION public.pictodico_words_validate();

-- Défis : seuls des mots valides issus de demandes d'ajout ; l'évènement lié fait foi pour numéro, date, horaires, titre.
CREATE OR REPLACE FUNCTION public.pictodico_challenges_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_w jsonb; v_e record;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.words IS DISTINCT FROM OLD.words THEN
    IF jsonb_typeof(coalesce(NEW.words, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'words doit être une liste'; END IF;
    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(NEW.words, '[]'::jsonb)) LOOP
      IF jsonb_typeof(v_w) <> 'string' OR NOT public.pictodico_word_is_valid(v_w #>> '{}') THEN
        RAISE EXCEPTION 'Mot de défi invalide : « % »', left(v_w #>> '{}', 80) USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.pictodico_words p WHERE p.request_type = 'demande_ajout'
                     AND public.pictodico_norm_key(p.word) = public.pictodico_norm_key(v_w #>> '{}')) THEN
        RAISE EXCEPTION 'Le mot « % » n''est pas une demande d''ajout du Picto-Dico', v_w #>> '{}' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    SELECT title, event_date, event_time, event_end_time INTO v_e FROM public.events WHERE id = NEW.event_id;
    IF FOUND THEN
      NEW.challenge_number := coalesce(substring(v_e.title from '#(\d+)')::int, NEW.challenge_number);
      NEW.challenge_date := v_e.event_date;
      NEW.challenge_time := coalesce(v_e.event_time, NEW.challenge_time);
      NEW.challenge_end_time := coalesce(v_e.event_end_time, NEW.challenge_end_time);
      NEW.title := coalesce(v_e.title, NEW.title);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pictodico_challenges_guard ON public.pictodico_challenges;
CREATE TRIGGER trg_pictodico_challenges_guard BEFORE INSERT OR UPDATE ON public.pictodico_challenges
  FOR EACH ROW EXECUTE FUNCTION public.pictodico_challenges_guard();

-- Un évènement modifié resynchronise son défi.
CREATE OR REPLACE FUNCTION public.pictodico_sync_challenge_from_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pictodico_challenges SET updated_at = now() WHERE event_id = NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pictodico_sync_from_event ON public.events;
CREATE TRIGGER trg_pictodico_sync_from_event AFTER UPDATE OF title, event_date, event_time, event_end_time ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.pictodico_sync_challenge_from_event();
REVOKE EXECUTE ON FUNCTION public.pictodico_sync_challenge_from_event() FROM PUBLIC, anon, authenticated;