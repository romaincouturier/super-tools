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
--
-- Corrigé le 2026-09-22, sans rapport avec la fermeture de l'en-tête : la
-- troisième branche référençait learner_magic_links, supprimée entre-temps
-- par la démolition du lien magique (20260918160000_demolition_lien_magique.sql).
-- Comme Postgres ne valide pas le corps d'une fonction plpgsql à la création,
-- cette branche morte n'aurait échoué qu'au premier appel, en silence, le
-- jour de la promotion de ce fichier. Les deux branches restantes passent
-- désormais par is_known_learner() (20260922100000_is_known_learner.sql),
-- qui les portait déjà de façon identique.
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
  IF public.is_known_learner(v_email) THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$function$;
