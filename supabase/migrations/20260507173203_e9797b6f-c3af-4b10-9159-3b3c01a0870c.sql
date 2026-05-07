
DO $$
DECLARE
  v_specs jsonb := '[
    {"name": "action-reminders-daily",            "minute": 0},
    {"name": "logistics-reminders-daily",         "minute": 7},
    {"name": "participant-list-reminders-daily",  "minute": 12},
    {"name": "process-coaching-reminders-daily",  "minute": 17},
    {"name": "process-live-reminders",            "minute": 22},
    {"name": "daily-scheduled-backup",            "minute": 27}
  ]'::jsonb;
  v_spec jsonb;
  v_jobid bigint;
BEGIN
  FOR v_spec IN SELECT * FROM jsonb_array_elements(v_specs)
  LOOP
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = v_spec->>'name';
    IF v_jobid IS NOT NULL THEN
      PERFORM cron.alter_job(v_jobid, schedule := (v_spec->>'minute') || ' 5 * * *');
    END IF;
  END LOOP;
END $$;
