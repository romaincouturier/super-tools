-- RPC function to expose pg_cron job statuses to the frontend
CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'jobs', COALESCE((
      SELECT json_agg(job_row ORDER BY job_row->>'jobname')
      FROM (
        SELECT json_build_object(
          'jobid', j.jobid,
          'jobname', j.jobname,
          'schedule', j.schedule,
          'command', LEFT(j.command, 200),
          'active', j.active,
          'last_run', (
            SELECT json_build_object(
              'status', d.status,
              'start_time', d.start_time,
              'end_time', d.end_time,
              'return_message', LEFT(d.return_message, 500)
            )
            FROM cron.job_run_details d
            WHERE d.jobid = j.jobid
            ORDER BY d.start_time DESC
            LIMIT 1
          ),
          'recent_runs', COALESCE((
            SELECT json_agg(run_row ORDER BY run_row->>'start_time' DESC)
            FROM (
              SELECT json_build_object(
                'status', d2.status,
                'start_time', d2.start_time,
                'end_time', d2.end_time,
                'return_message', LEFT(d2.return_message, 500)
              ) AS run_row
              FROM cron.job_run_details d2
              WHERE d2.jobid = j.jobid
              ORDER BY d2.start_time DESC
              LIMIT 10
            ) sub
          ), '[]'::json)
        ) AS job_row
        FROM cron.job j
      ) jobs_sub
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_status() TO authenticated;
