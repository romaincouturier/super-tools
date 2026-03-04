-- Fix search_path on all functions that are missing it

CREATE OR REPLACE FUNCTION public.delete_media_for_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.media
  WHERE source_type = TG_ARGV[0]
    AND source_id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_size_bytes', pg_database_size(current_database()),
    'table_sizes', (
      SELECT json_object_agg(
        schemaname || '.' || tablename,
        pg_total_relation_size(schemaname || '.' || tablename)
      )
      FROM pg_tables
      WHERE schemaname = 'public'
    )
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_api_key_last_used(key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE api_keys SET last_used_at = now() WHERE id = key_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_crm_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_crm_columns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_devis_signatures_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;