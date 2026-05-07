
DO $$
DECLARE
  v_specs jsonb := '[
    {"name": "action-reminders-daily",            "minute": 0},
    {"name": "logistics-reminders-daily",         "minute": 5},
    {"name": "participant-list-reminders-daily",  "minute": 10},
    {"name": "process-coaching-reminders-daily",  "minute": 15},
    {"name": "process-live-reminders",            "minute": 20},
    {"name": "daily-scheduled-backup",            "minute": 25}
  ]'::jsonb;
  v_spec jsonb;
  v_jobid bigint;
  v_new_schedule text;
BEGIN
  FOR v_spec IN SELECT * FROM jsonb_array_elements(v_specs)
  LOOP
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = v_spec->>'name';
    IF v_jobid IS NOT NULL THEN
      v_new_schedule := (v_spec->>'minute') || ' 5 * * *';
      PERFORM cron.alter_job(v_jobid, schedule := v_new_schedule);
    END IF;
  END LOOP;
END $$;
