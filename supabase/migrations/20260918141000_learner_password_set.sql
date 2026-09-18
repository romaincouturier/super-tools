-- Réutilisé par sendLearnerAccessEmail (Flux A sans lien magique) pour choisir
-- entre un lien de création de mot de passe (compte tout juste provisionné,
-- password_set = false) et un lien qui préremplit juste l'adresse sur
-- /connexion (compte déjà équipé d'un mot de passe). Renvoie NULL si
-- l'adresse ne correspond à aucun compte, pour ne jamais révéler son
-- existence à l'appelant.

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

  SELECT password_set INTO v_has_pwd
    FROM user_security_metadata WHERE user_id = v_user_id;
  -- Absence de ligne : compte antérieur au drapeau, donc avec mot de passe.
  RETURN COALESCE(v_has_pwd, true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.learner_password_set(text) FROM PUBLIC, anon, authenticated;
