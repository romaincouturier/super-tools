-- Corrections de la passe 4 de recette (docs/RECETTE_CONNEXION.md).
--   RG-08 : limitation de débit serveur sur l'envoi de liens
--   RG-24 : purge effective du journal de résolution
--   W8.5  : les autres sessions tombent quand le mot de passe change

-- ── RG-08. Quota d'envoi de liens ───────────────────────────────────────────
-- 3 par adresse et 10 par adresse IP sur une heure glissante (chapitre 6.3).
-- Au-delà, l'appelant affiche le même message et aucun email ne part.
CREATE OR REPLACE FUNCTION public.check_link_quota(p_email_hash text, p_ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip    text := COALESCE(NULLIF(p_ip, ''), 'unknown');
  v_count integer;
BEGIN
  IF p_email_hash IS NULL OR p_email_hash = '' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE email_hash = p_email_hash AND state = 'link_sent'
     AND resolved_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count FROM identity_resolution_log
   WHERE ip_address = v_ip AND v_ip <> 'unknown' AND state = 'link_sent'
     AND resolved_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
    RETURN false;
  END IF;

  INSERT INTO identity_resolution_log (email_hash, ip_address, state)
  VALUES (p_email_hash, v_ip, 'link_sent');
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_link_quota(text, text) FROM PUBLIC, anon, authenticated;

-- ── RG-24. Purge quotidienne du journal ─────────────────────────────────────
SELECT cron.unschedule('purge-identity-resolution-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-identity-resolution-log');

SELECT cron.schedule(
  'purge-identity-resolution-log',
  '20 3 * * *',
  $$SELECT public.purge_identity_resolution_log();$$
);

-- ── W8.5. Fermeture des autres sessions ─────────────────────────────────────
-- Après un changement de mot de passe, les sessions ouvertes ailleurs tombent.
-- La session courante est épargnée, sinon l'utilisateur se retrouverait dehors
-- juste après avoir défini son mot de passe.
CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current uuid;
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  v_current := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;

  DELETE FROM auth.sessions
   WHERE user_id = auth.uid()
     AND (v_current IS NULL OR id <> v_current);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.revoke_other_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;
