-- Réclamation déposée depuis l'espace apprenant (indicateur 31).
--
-- Jusqu'ici, une insatisfaction pédagogique ou administrative déposée par un
-- apprenant partait dans le kanban produit, entre les bugs, et n'arrivait
-- jamais au registre des réclamations. Le référentiel attend que les
-- réclamations, difficultés et aléas soient traités et tracés.
--
-- La fonction ci-dessous est le seul chemin d'écriture ouvert à un apprenant.
-- Elle ne prend ni adresse ni nom en paramètre : l'identité vient du compte
-- connecté. Un apprenant ne peut donc pas déposer une réclamation au nom d'un
-- autre, ni choisir le statut ou la date.
--
-- Additive et idempotente. Aucune donnée existante n'est modifiée.

CREATE OR REPLACE FUNCTION public.create_learner_reclamation(
  p_subject text,
  p_description text,
  p_nature text,
  p_problem_type text,
  p_training_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_name text;
  v_token text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'no email on account';
  END IF;

  IF coalesce(trim(p_description), '') = '' THEN
    RAISE EXCEPTION 'description required';
  END IF;

  -- Natures et types bornés : une valeur libre afficherait un libellé vide
  -- dans le registre et fausserait les comptes.
  IF p_nature NOT IN ('reclamation', 'alea', 'difficulte') THEN
    RAISE EXCEPTION 'invalid nature';
  END IF;
  IF p_problem_type NOT IN ('contenu','organisation','logistique','technique','facturation','relationnel','autre') THEN
    RAISE EXCEPTION 'invalid problem_type';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', first_name, last_name)), ''), v_email)
    INTO v_name
  FROM public.profiles
  WHERE id = auth.uid();

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.reclamations (
    token, date_reclamation, client_name, client_email, canal,
    nature, problem_type, description, status, training_id
  ) VALUES (
    v_token, current_date, coalesce(v_name, v_email), v_email, 'formulaire',
    p_nature, p_problem_type,
    -- Le sujet saisi par l'apprenant ouvre la description : le registre n'a
    -- pas de colonne de titre.
    CASE WHEN coalesce(trim(p_subject), '') = '' THEN trim(p_description)
         ELSE trim(p_subject) || E'\n\n' || trim(p_description) END,
    'open', p_training_id
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'token', v_token);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_learner_reclamation(text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_learner_reclamation(text, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.create_learner_reclamation(text, text, text, text, uuid) IS
  'Dépôt d''une réclamation, difficulté ou aléa par un apprenant connecté. Identité lue sur le compte, jamais reçue en paramètre.';
