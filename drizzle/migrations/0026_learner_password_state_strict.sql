-- Absence de ligne de sécurité = aucun mot de passe prouvé (comptes de l'époque du lien magique).
CREATE OR REPLACE FUNCTION public.learner_password_set(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_has_pwd boolean;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT password_set INTO v_has_pwd FROM public.user_security_metadata WHERE user_id = v_user_id;
  RETURN COALESCE(v_has_pwd, false);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.learner_password_set(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learner_password_set(text) TO service_role;

-- Une connexion réussie par mot de passe prouve qu'un mot de passe existe.
-- Ne touche jamais must_change_password (changement forcé conservé).
CREATE OR REPLACE FUNCTION public.mark_password_proven()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  INSERT INTO public.user_security_metadata (user_id, password_set)
  VALUES (auth.uid(), true)
  ON CONFLICT (user_id) DO UPDATE SET password_set = true, updated_at = now()
  WHERE public.user_security_metadata.password_set IS DISTINCT FROM true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.mark_password_proven() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_proven() TO authenticated;