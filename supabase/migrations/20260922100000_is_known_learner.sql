-- Un seul point d'entrée pour « cette adresse est-elle une apprenante
-- connue ? ». Extraction, sans changement de comportement, des deux mêmes
-- EXISTS déjà dupliqués dans get_learner_email() (le portail RLS, appelé
-- par une centaine de policies) et current_user_access_level() : les deux
-- copies avaient déjà des chances de diverger sans que personne ne le
-- décide (get_learner_portal_data avait raté lms_enrollments avant d'être
-- corrigée dans ce même chantier). Rien d'autre ne change : aucune policy,
-- aucune table, aucune donnée. change_learner_email (vérifie aussi
-- auth.users, staff-only, hors chemin RLS), get_learner_portal_data
-- (construit une charge utile jointe, pas un booléen) et
-- list_dormant_learner_accounts (vérifie une activité récente, pas une
-- simple existence) restent volontairement en dehors de cette migration.

CREATE OR REPLACE FUNCTION public.is_known_learner(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM training_participants WHERE lower(email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_known_learner(text) FROM PUBLIC, anon, authenticated;

-- get_learner_email et current_user_access_level : mêmes droits qu'avant
-- (posés dans une migration antérieure), CREATE OR REPLACE ne les touche
-- pas ; seul le corps change, pour appeler is_known_learner.

-- get_learner_email : mêmes deux EXISTS, désormais portés par is_known_learner.
CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(
      (current_setting('request.headers', true)::json->>'x-learner-email')
    );
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;
  IF public.is_known_learner(v_email) THEN
    RETURN v_email;
  END IF;
  RETURN NULL;
END;
$function$;

-- current_user_access_level : même remplacement pour sa branche « learner ».
CREATE OR REPLACE FUNCTION public.current_user_access_level()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RETURN 'staff';
  END IF;

  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    RETURN 'none';
  END IF;

  IF public.is_known_learner(v_email) THEN
    RETURN 'learner';
  END IF;

  RETURN 'none';
END;
$function$;
