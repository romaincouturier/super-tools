-- Corrections issues de la recette (docs/RECETTE_CONNEXION.md, passe 2).
--   critère 13 : un compte sans rattachement doit être reconnu comme tel
--   critère 11 : dernière fonction de portail prenant l'identité en paramètre
--   critère 23 : mention de la création de compte dans les modèles d'email

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
REVOKE EXECUTE ON FUNCTION public.learner_evaluation_course_id(text, uuid) FROM anon;

-- ── Critère 23. Mention de la création de compte ────────────────────────────
-- Ajoutée à la suite du bloc sur la durée de validité, en tutoiement ou
-- vouvoiement selon le modèle. Rejouable : la mention n'est ajoutée qu'une fois.
UPDATE public.email_templates
SET html_content = html_content || E'\n\n<p style="font-size: 13px; color: #666;">Un espace apprenant a été créé avec ton adresse email pour te donner accès à ta formation. Tes données sont traitées par SuperTilt à cette seule fin. Pour demander la suppression de ton compte, écris-nous à contact@supertilt.fr.</p>'
WHERE template_type IN ('elearning_magic_link_tu', 'elearning_start_reminder_tu')
  AND html_content NOT LIKE '%demander la suppression de ton compte%';

UPDATE public.email_templates
SET html_content = html_content || E'\n\n<p style="font-size: 13px; color: #666;">Un espace apprenant a été créé avec votre adresse email pour vous donner accès à votre formation. Vos données sont traitées par SuperTilt à cette seule fin. Pour demander la suppression de votre compte, écrivez-nous à contact@supertilt.fr.</p>'
WHERE template_type IN ('elearning_magic_link_vous', 'elearning_start_reminder_vous')
  AND html_content NOT LIKE '%demander la suppression de votre compte%';
