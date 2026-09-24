-- Red team : quatre RPC SECURITY DEFINER exécutables par tout compte connecté,
-- sans contrôle de droit. L'inscription est ouverte : un apprenant a une
-- session et lisait l'état des crons (commandes SQL comprises), l'annuaire du
-- staff, les retours des évaluations formateur, et testait l'existence de
-- comptes par adresse (énumération).
--
-- Garde : public.is_staff_user() (admin ou accès à un module), en tête de
-- corps. Les corps sont repris à l'identique de leur dernière définition :
--   get_cron_status                   20260924102525_a300ca3e-...
--   get_previous_trainer_evaluations  20260308202024_2d60e8f7-...
--   learner_accounts_for_emails       20260526140000_learner_accounts_for_emails
--   get_staff_directory               20260701192000_staff_directory_rpc
-- Les droits d'exécution (authenticated, service_role, pas anon) sont ceux
-- posés par 20260915090829 et 20260526140000 : inchangés.

CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  WITH recent AS (
    SELECT
      d.jobid,
      d.status,
      d.start_time,
      d.end_time,
      LEFT(d.return_message, 500) AS return_message,
      row_number() OVER (PARTITION BY d.jobid ORDER BY d.start_time DESC) AS rn
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '14 days'
  ),
  runs AS (
    SELECT
      jobid,
      json_agg(
        json_build_object(
          'status', status,
          'start_time', start_time,
          'end_time', end_time,
          'return_message', return_message
        ) ORDER BY start_time DESC
      ) AS recent_runs
    FROM recent
    WHERE rn <= 10
    GROUP BY jobid
  )
  SELECT json_build_object(
    'jobs', COALESCE((
      SELECT json_agg(
        json_build_object(
          'jobid', j.jobid,
          'jobname', j.jobname,
          'schedule', j.schedule,
          'command', LEFT(j.command, 200),
          'active', j.active,
          'last_run', r.recent_runs -> 0,
          'recent_runs', COALESCE(r.recent_runs, '[]'::json)
        ) ORDER BY j.jobname
      )
      FROM cron.job j
      LEFT JOIN runs r ON r.jobid = j.jobid
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_previous_trainer_evaluations(p_trainer_email text, p_exclude_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(json_build_object('points_forts', points_forts, 'axes_amelioration', axes_amelioration, 'commentaires', commentaires)), '[]'::json)
    FROM trainer_evaluations
    WHERE trainer_email = p_trainer_email AND status = 'soumis' AND id != p_exclude_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.learner_accounts_for_emails(p_emails text[])
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT lower(u.email)::text
  FROM auth.users u
  WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(p_emails) AS e);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE (user_id uuid, first_name text, last_name text, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.last_name, p.email, p.display_name
  FROM public.profiles p
  ORDER BY p.first_name ASC NULLS LAST;
END;
$$;
