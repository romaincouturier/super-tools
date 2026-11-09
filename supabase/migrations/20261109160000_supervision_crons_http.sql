-- Supervision des crons : voir les échecs HTTP, et sortir le chien de garde de
-- la sauvegarde de ce qu'il surveille.
--
-- Deux angles morts constatés le 9 novembre 2026, qui ont laissé la sauvegarde
-- de la base muette pendant six jours (dernier succès le 3 novembre) :
--
-- 1. monitor_cron_failures() ne lit que cron.job_run_details.status. Or
--    net.http_post rend la main dès que la requête est mise en file : au niveau
--    SQL le job réussit toujours, quel que soit le code HTTP. 174 réponses 401
--    sur 826 appels conservés, et zéro échec signalé.
-- 2. L'alerte « aucune sauvegarde depuis 26 h » vit dans scheduled-backup.
--    Cette fonction étant refusée en 401 avant d'exécuter quoi que ce soit, le
--    chien de garde est enfermé dans ce qu'il surveille.
--
-- La détection est séparée de l'alerte : deux fonctions de lecture pure,
-- testables sans effet de bord, et un rapporteur qui écrit dans les actions du
-- jour des administrateurs. Pas d'email ici, donc aucune clé recopiée dans
-- cette migration ; la voie email reste celle de monitor_cron_failures().

-- Fraîcheur de la dernière sauvegarde de la base. Lecture seule.
-- `db_status` seul fait foi : la copie storage a son propre statut et sa propre
-- fenêtre, elle ne tient pas dans un passage de cron.
CREATE OR REPLACE FUNCTION public.backup_freshness()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  dernier timestamptz;
BEGIN
  SELECT max(db_finished_at) INTO dernier
  FROM public.backup_runs
  WHERE db_status = 'success';

  RETURN jsonb_build_object(
    'last_success', dernier,
    'age_hours', CASE
      WHEN dernier IS NULL THEN NULL
      ELSE round((extract(epoch FROM now() - dernier) / 3600)::numeric, 1)
    END,
    -- Jamais sauvegardé vaut périmé : l'absence de ligne est le pire des cas,
    -- pas un cas neutre.
    'stale', dernier IS NULL OR now() - dernier > interval '26 hours'
  );
END;
$function$;

-- Échecs HTTP des appels sortants sur la fenêtre que pg_net conserve.
--
-- pg_net vide net.http_request_queue dès la réponse reçue et net._http_response
-- ne porte pas d'URL : on ne peut donc pas nommer la fonction appelée. Le
-- regroupement par code et par début de corps suffit à voir qu'une panne dure,
-- et `retention` dit sur quelle fenêtre la mesure porte (6 h par défaut), pour
-- qu'un total ne soit pas lu comme un total sur 24 h.
CREATE OR REPLACE FUNCTION public.cron_http_failures_24h()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total int;
  groupes jsonb;
BEGIN
  SELECT count(*) INTO total
  FROM net._http_response
  WHERE created > now() - interval '24 hours'
    AND (status_code IS NULL OR status_code >= 400 OR error_msg IS NOT NULL);

  SELECT jsonb_agg(g) INTO groupes FROM (
    SELECT jsonb_build_object(
      'status_code', status_code,
      'error_msg', left(error_msg, 120),
      'body', left(content, 120),
      'occurrences', count(*),
      'last_seen', max(created)
    ) AS g
    FROM net._http_response
    WHERE created > now() - interval '24 hours'
      AND (status_code IS NULL OR status_code >= 400 OR error_msg IS NOT NULL)
    GROUP BY status_code, left(error_msg, 120), left(content, 120)
    ORDER BY count(*) DESC
    LIMIT 20
  ) s;

  RETURN jsonb_build_object(
    'total', coalesce(total, 0),
    'groups', coalesce(groupes, '[]'::jsonb),
    'retention', coalesce(current_setting('pg_net.ttl', true), 'inconnue')
  );
END;
$function$;

-- Rapporteur : inscrit un constat dans les actions du jour des administrateurs.
--
-- Les actions du jour plutôt qu'un email : c'est l'endroit déjà consulté chaque
-- matin, et le constat revient tant que la panne dure au lieu de se noyer dans
-- une boîte de réception. La clé d'unicité (user_id, action_date, category,
-- entity_type, entity_id) rend l'écriture rejouable ; is_completed est hors de
-- la charge utile, donc une action déjà cochée le reste.
CREATE OR REPLACE FUNCTION public.report_cron_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sauvegarde jsonb;
  http jsonb;
  ecrites int := 0;
BEGIN
  sauvegarde := public.backup_freshness();
  http := public.cron_http_failures_24h();

  IF (sauvegarde->>'stale')::boolean THEN
    INSERT INTO public.daily_actions
      (user_id, action_date, category, title, description, link, entity_type, entity_id)
    SELECT p.user_id, current_date, 'supervision',
           'Sauvegarde de la base en retard',
           CASE
             WHEN sauvegarde->>'last_success' IS NULL
               THEN 'Aucune sauvegarde de la base n''a jamais abouti.'
             ELSE 'Dernier succès il y a ' || (sauvegarde->>'age_hours') ||
                  ' h. Vérifier le cron daily-scheduled-backup et les droits de scheduled-backup.'
           END,
           '/parametres', 'cron_health', 'backup_stale'
    FROM public.profiles p
    WHERE p.is_admin = true AND p.user_id IS NOT NULL
    ON CONFLICT (user_id, action_date, category, entity_type, entity_id)
    DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
    GET DIAGNOSTICS ecrites = ROW_COUNT;
  END IF;

  IF (http->>'total')::int > 0 THEN
    INSERT INTO public.daily_actions
      (user_id, action_date, category, title, description, link, entity_type, entity_id)
    SELECT p.user_id, current_date, 'supervision',
           'Appels de cron rejetés : ' || (http->>'total'),
           'Sur la fenêtre conservée par pg_net (' || (http->>'retention') ||
           '). pg_net ne garde pas l''URL appelée : diagnostiquer avec ' ||
           'select public.cron_http_failures_24h().',
           '/parametres', 'cron_health', 'http_failures'
    FROM public.profiles p
    WHERE p.is_admin = true AND p.user_id IS NOT NULL
    ON CONFLICT (user_id, action_date, category, entity_type, entity_id)
    DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  END IF;

  RETURN jsonb_build_object('backup', sauvegarde, 'http', http, 'actions_backup', ecrites);
END;
$function$;

-- Après generate-daily-actions (06:05), qui supprime les actions non terminées
-- du jour avant de régénérer les siennes : planifié avant, ce constat serait
-- effacé sans trace. 06:40 est pris par l'audit Qualiopi, d'où 06:45.
SELECT cron.unschedule('report-cron-health')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'report-cron-health');

SELECT cron.schedule('report-cron-health', '45 6 * * *', $cron$ SELECT public.report_cron_health(); $cron$);
