-- Fonctions internes SECURITY DEFINER appelables par tout compte connecté,
-- sans vérifier de droit (alertes 0029 du contrôle de sécurité). L'inscription
-- étant ouverte, un apprenant a une session : il pouvait lire l'état des
-- tâches planifiées, commandes comprises (secrets de cron inclus), savoir si
-- une liste d'emails a un compte, et lire des statistiques internes.
--
-- Corps repris à l'identique de la production (pg_get_functiondef, 24/09/2026),
-- seule la garde est ajoutée (règle [063] : un droit, pas une session).
-- get_db_size reste appelable en service role (record-db-size) et en SQL
-- direct sans jeton (hourly-db-size-snapshot dans sa version d'origine).

CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Réservé à l''équipe SuperTilt' USING ERRCODE = '42501';
  END IF;
  WITH recent AS (
    SELECT d.jobid, d.status, d.start_time, d.end_time, LEFT(d.return_message, 500) AS return_message,
           row_number() OVER (PARTITION BY d.jobid ORDER BY d.start_time DESC) AS rn
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '14 days'
  ), runs AS (
    SELECT jobid, json_agg(json_build_object('status', status, 'start_time', start_time, 'end_time', end_time, 'return_message', return_message) ORDER BY start_time DESC) AS recent_runs
    FROM recent WHERE rn <= 10 GROUP BY jobid
  )
  SELECT json_build_object('jobs', COALESCE((
    SELECT json_agg(json_build_object(
      'jobid', j.jobid, 'jobname', j.jobname, 'schedule', j.schedule, 'command', LEFT(j.command, 200),
      'active', j.active, 'last_run', r.recent_runs -> 0, 'recent_runs', COALESCE(r.recent_runs, '[]'::json)
    ) ORDER BY j.jobname)
    FROM cron.job j LEFT JOIN runs r ON r.jobid = j.jobid
  ), '[]'::json)) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  result JSON;
BEGIN
  -- Un appel par l'API porte toujours le rôle anon ou authenticated. Sans
  -- rôle, c'est un appel interne (tâche planifiée en SQL direct) : autorisé,
  -- comme le service role (record-db-size).
  IF NOT (public.is_staff_user() OR COALESCE(auth.jwt() ->> 'role', '') NOT IN ('anon', 'authenticated')) THEN
    RAISE EXCEPTION 'Réservé à l''équipe SuperTilt' USING ERRCODE = '42501';
  END IF;
  SELECT json_build_object(
    'total_size_bytes', pg_database_size(current_database()),
    'table_sizes', (
      SELECT json_object_agg(schemaname || '.' || tablename, pg_total_relation_size(schemaname || '.' || tablename))
      FROM pg_tables WHERE schemaname = 'public'
    )
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.learner_accounts_for_emails(p_emails text[])
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT lower(u.email) FROM auth.users u
  WHERE public.is_staff_user()
    AND lower(u.email) = ANY (SELECT lower(e) FROM unnest(p_emails) AS e);
$function$;

CREATE OR REPLACE FUNCTION public.get_nav_usage_counts()
RETURNS TABLE(segment text, clicks bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT split_part(COALESCE(metadata->>'path', ''), '/', 2) AS segment, count(*)::bigint AS clicks
  FROM public.feature_usage
  WHERE public.is_staff_user()
    AND feature_name = 'page_view'
    AND created_at > now() - interval '90 days'
    AND COALESCE(metadata->>'path', '') <> ''
  GROUP BY 1;
$function$;
