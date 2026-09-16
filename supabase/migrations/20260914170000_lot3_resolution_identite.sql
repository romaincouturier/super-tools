-- Lot 3 de la refonte de connexion apprenant.
-- Référence : docs/SPEC_CONNEXION_APPRENANT.md chapitre 6.
-- Apporte les trois pièces du service de résolution d'identité :
--   1. le drapeau password_set, source explicite de "mot de passe défini"
--   2. le journal de résolution et la limitation de débit
--   3. la fonction de résolution, réservée au rôle de service

-- ── 1. password_set ─────────────────────────────────────────────────────────
-- Défaut vrai : les trois chemins de création actuels imposent tous un mot de
-- passe, la reprise de l'existant est donc exacte. Les comptes provisionnés
-- sans mot de passe (lot 5) poseront explicitement false.
ALTER TABLE public.user_security_metadata
  ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_security_metadata.password_set IS
  'Vrai si le compte a un mot de passe utilisable. Écrit uniquement côté serveur.';

-- Le retrait de l'écriture directe par l'utilisateur attend la publication du
-- front : deux écrans encore en ligne s'en servent. Voir
-- supabase/migrations-apres-front/20260915115000_apres_front_retrait_policy_securite.sql

-- ── 2. Les deux transitions légitimes, par fonction ─────────────────────────
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  INSERT INTO user_security_metadata (user_id, must_change_password, password_set)
  VALUES (auth.uid(), false, true)
  ON CONFLICT (user_id) DO UPDATE
    SET must_change_password = false, password_set = true, updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  INSERT INTO user_security_metadata (user_id, must_change_password)
  VALUES (auth.uid(), true)
  ON CONFLICT (user_id) DO UPDATE
    SET must_change_password = true, updated_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_password_change() TO authenticated;

-- ── 3. Journal de résolution ────────────────────────────────────────────────
-- L'adresse n'est jamais stockée en clair (RG-24) : seule son empreinte, avec
-- l'adresse IP et l'état renvoyé, conservées 30 jours.
CREATE TABLE IF NOT EXISTS public.identity_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_address text NOT NULL DEFAULT 'unknown',
  state text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_resolution_email
  ON public.identity_resolution_log (email_hash, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_resolution_ip
  ON public.identity_resolution_log (ip_address, resolved_at DESC);

ALTER TABLE public.identity_resolution_log ENABLE ROW LEVEL SECURITY;
-- Aucune policy : la table n'est accessible qu'au rôle de service.

CREATE OR REPLACE FUNCTION public.purge_identity_resolution_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM identity_resolution_log WHERE resolved_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_identity_resolution_log() FROM PUBLIC, anon, authenticated;

-- ── 4. Résolution d'identité ────────────────────────────────────────────────
-- Renvoie un état d'aiguillage et rien d'autre : ni nom, ni rôle, ni formation
-- (RG-26). Les seuils du chapitre 6.3 sont appliqués ici, côté serveur.
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
  IF v_count >= 5 THEN
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
