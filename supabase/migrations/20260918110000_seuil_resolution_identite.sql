-- Assouplit le seuil de résolution d'identité par adresse : 5 par heure
-- bloquait un apprenant qui retentait sa connexion plusieurs fois en peu de
-- temps (chaque soumission de l'étape email déclenche une résolution). Passé
-- à 10, sur constat en production le 18/09/2026. Le seuil par adresse IP
-- (20/heure) est inchangé : aucune preuve qu'il ait été atteint.

CREATE OR REPLACE FUNCTION public.resolve_login_identity(
  p_email text,
  p_email_hash text,
  p_ip text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email   text := lower(trim(p_email));
  v_ip      text := COALESCE(NULLIF(p_ip, ''), 'unknown');
  v_user_id uuid;
  v_has_pwd boolean;
  v_known   boolean;
  v_count   integer;
  v_state   text;
BEGIN
  IF v_email IS NULL OR v_email = '' OR p_email_hash IS NULL OR p_email_hash = '' THEN
    RETURN 'unknown';
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE email_hash = p_email_hash AND resolved_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
    INSERT INTO identity_resolution_log (email_hash, ip_address, state)
    VALUES (p_email_hash, v_ip, 'throttled');
    RETURN 'throttled';
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE ip_address = v_ip AND v_ip <> 'unknown' AND resolved_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    INSERT INTO identity_resolution_log (email_hash, ip_address, state)
    VALUES (p_email_hash, v_ip, 'throttled');
    RETURN 'throttled';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT password_set INTO v_has_pwd
      FROM user_security_metadata WHERE user_id = v_user_id;
    -- Absence de ligne : compte antérieur au drapeau, donc avec mot de passe.
    v_state := CASE WHEN COALESCE(v_has_pwd, true) THEN 'password' ELSE 'link' END;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM training_participants WHERE lower(email) = v_email
    ) OR EXISTS (
      SELECT 1 FROM lms_enrollments WHERE lower(learner_email) = v_email
    ) INTO v_known;
    v_state := CASE WHEN v_known THEN 'activation' ELSE 'unknown' END;
  END IF;

  INSERT INTO identity_resolution_log (email_hash, ip_address, state)
  VALUES (p_email_hash, v_ip, v_state);

  RETURN v_state;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_login_identity(text, text, text) FROM PUBLIC, anon, authenticated;
