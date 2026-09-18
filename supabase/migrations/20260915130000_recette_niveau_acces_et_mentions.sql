-- Corrections issues de la recette (docs/COUVERTURE_CONNEXION.md, passe 2).
--   critère 13 : un compte sans rattachement doit être reconnu comme tel
--   critère 11 : dernière fonction de portail prenant l'identité en paramètre
--   critère 23 : mention de la création de compte, différée après le front

-- ── Critère 13. Niveau d'accès du compte connecté ───────────────────────────
-- Une seule source pour la garde de route : staff, apprenant, ou aucun des deux.
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

  IF EXISTS (SELECT 1 FROM training_participants WHERE lower(email) = v_email)
     OR EXISTS (SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email)
     OR EXISTS (SELECT 1 FROM learner_magic_links
                 WHERE lower(email) = v_email AND used_at IS NOT NULL) THEN
    RETURN 'learner';
  END IF;

  RETURN 'none';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_access_level() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_level() TO authenticated;

-- ── Critère 11. Plus d'identité en paramètre pour un appelant anonyme ───────
-- Retrait déplacé dans supabase/migrations-apres-front/ : le lecteur LMS
-- actuellement publié appelle cette fonction en anonyme.

-- ── Critère 23. Mention de la création de compte ────────────────────────────
-- Les mises à jour de modèles d'email attendent la publication du front :
-- supabase/migrations-apres-front/20260915135000_apres_front_mentions_modeles.sql
