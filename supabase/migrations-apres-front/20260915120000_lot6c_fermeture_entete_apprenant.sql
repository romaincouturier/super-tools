-- Fermeture de l'en-tête x-learner-email.
-- Référence : docs/AUDIT_SURFACES_EXPOSEES.md, chantier 1.
--
-- Jusqu'ici, get_learner_email() acceptait une adresse déclarée par le
-- navigateur dès qu'aucune session n'était ouverte. Connaître l'adresse d'un
-- apprenant suffisait donc à lire et écrire ses données sur les 22 tables dont
-- les policies dépendent de cette fonction.
--
-- Désormais l'identité vient exclusivement du jeton d'authentification (PR7).
-- Préalable posé par les lots 3 à 5 : tout apprenant peut obtenir un compte
-- depuis la page de connexion, et l'inscription en provisionne un d'office.
-- La fonction backfill-learner-accounts provisionne les apprenants restants.
--
-- Effet pour un visiteur non connecté : les contenus publiés restent lisibles,
-- mais plus aucune donnée personnelle n'est lue ni écrite en son nom.
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
    RETURN NULL;
  END IF;

  -- L'adresse doit correspondre à un apprenant connu : un compte staff ne
  -- devient pas apprenant par le simple fait d'être authentifié.
  IF EXISTS (
    SELECT 1 FROM training_participants WHERE lower(email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
  ) OR EXISTS (
    SELECT 1 FROM learner_magic_links
    WHERE lower(email) = v_email AND used_at IS NOT NULL
  ) THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$function$;
