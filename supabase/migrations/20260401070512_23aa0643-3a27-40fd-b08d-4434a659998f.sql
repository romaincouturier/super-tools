-- Function to adjust all cron schedules based on current Paris timezone offset
CREATE OR REPLACE FUNCTION public.adjust_cron_timezones()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_offset int;
  v_stored_offset int;
  v_diff int;
  v_updated int := 0;
  v_job record;
  v_parts text[];
  v_hour int;
  v_new_hour int;
  v_new_schedule text;
BEGIN
  -- Get current UTC offset for Paris (positive = ahead of UTC)
  v_current_offset := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris' - now() AT TIME ZONE 'UTC'))::int;
  
  -- Get previously stored offset
  SELECT setting_value::int INTO v_stored_offset 
  FROM app_settings 
  WHERE setting_key = 'cron_utc_offset';
  
  -- If no stored offset, store current and return
  IF v_stored_offset IS NULL THEN
    INSERT INTO app_settings (setting_key, setting_value, description)
    VALUES ('cron_utc_offset', v_current_offset::text, 'Dernier décalage UTC appliqué aux crons (géré automatiquement)')
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = v_current_offset::text, updated_at = now();
    RETURN json_build_object('status', 'initialized', 'offset', v_current_offset);
  END IF;
  
  -- If offset hasn't changed, nothing to do
  IF v_current_offset = v_stored_offset THEN
    RETURN json_build_object('status', 'no_change', 'offset', v_current_offset);
  END IF;
  
  -- Calculate difference (e.g., winter→summer: 2-1 = +1, need to shift crons -1 hour in UTC)
  v_diff := v_stored_offset - v_current_offset; -- negative means shift earlier in UTC
  
  -- Update all non-frequent crons (skip hourly and */15 patterns)
  FOR v_job IN 
    SELECT jobid, schedule FROM cron.job 
    WHERE schedule NOT LIKE '*/%' 
    AND schedule NOT LIKE '* *%'
  LOOP
    v_parts := string_to_array(v_job.schedule, ' ');
    -- v_parts: {minute, hour, day, month, dow}
    
    -- Only adjust if hour is a number (not *)
    IF v_parts[2] ~ '^\d+$' THEN
      v_hour := v_parts[2]::int;
      v_new_hour := (v_hour + v_diff + 24) % 24;
      v_parts[2] := v_new_hour::text;
      v_new_schedule := array_to_string(v_parts, ' ');
      
      PERFORM cron.alter_job(v_job.jobid, schedule := v_new_schedule);
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  
  -- Store new offset
  UPDATE app_settings SET setting_value = v_current_offset::text, updated_at = now()
  WHERE setting_key = 'cron_utc_offset';
  
  RETURN json_build_object(
    'status', 'adjusted',
    'old_offset', v_stored_offset,
    'new_offset', v_current_offset,
    'jobs_updated', v_updated
  );
END;
$$;