CREATE OR REPLACE FUNCTION public.sync_training_schedules_from_lives(p_training_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live_count int;
BEGIN
  IF p_training_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_live_count
  FROM public.training_live_meetings
  WHERE training_id = p_training_id
    AND coalesce(status, 'scheduled') <> 'cancelled';

  IF v_live_count = 0 THEN
    RETURN;
  END IF;

  WITH live_days AS (
    SELECT
      ((scheduled_at AT TIME ZONE 'Europe/Paris')::date) AS day_date,
      min((scheduled_at AT TIME ZONE 'Europe/Paris')::time) AS start_time,
      max(((scheduled_at + make_interval(mins => coalesce(duration_minutes, 60))) AT TIME ZONE 'Europe/Paris')::time) AS end_time
    FROM public.training_live_meetings
    WHERE training_id = p_training_id
      AND coalesce(status, 'scheduled') <> 'cancelled'
    GROUP BY 1
  ),
  deleted AS (
    DELETE FROM public.training_schedules ts
    WHERE ts.training_id = p_training_id
      AND NOT EXISTS (SELECT 1 FROM live_days ld WHERE ld.day_date = ts.day_date)
    RETURNING 1
  ),
  updated AS (
    UPDATE public.training_schedules ts
    SET start_time = ld.start_time,
        end_time = ld.end_time
    FROM live_days ld
    WHERE ts.training_id = p_training_id
      AND ts.day_date = ld.day_date
      AND (ts.start_time IS DISTINCT FROM ld.start_time OR ts.end_time IS DISTINCT FROM ld.end_time)
    RETURNING 1
  )
  INSERT INTO public.training_schedules (training_id, day_date, start_time, end_time)
  SELECT p_training_id, ld.day_date, ld.start_time, ld.end_time
  FROM live_days ld
  WHERE NOT EXISTS (
    SELECT 1 FROM public.training_schedules ts
    WHERE ts.training_id = p_training_id AND ts.day_date = ld.day_date
  );

  UPDATE public.trainings t
  SET start_date = agg.min_day,
      end_date = agg.max_day
  FROM (
    SELECT min(day_date) AS min_day, max(day_date) AS max_day
    FROM public.training_schedules
    WHERE training_id = p_training_id
  ) agg
  WHERE t.id = p_training_id
    AND agg.min_day IS NOT NULL
    AND (t.start_date IS DISTINCT FROM agg.min_day OR t.end_date IS DISTINCT FROM agg.max_day);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_training_schedules_from_lives()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_training_schedules_from_lives(OLD.training_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_training_schedules_from_lives(NEW.training_id);
  IF TG_OP = 'UPDATE' AND OLD.training_id IS DISTINCT FROM NEW.training_id THEN
    PERFORM public.sync_training_schedules_from_lives(OLD.training_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_schedules_from_lives ON public.training_live_meetings;
CREATE TRIGGER sync_schedules_from_lives
AFTER INSERT OR UPDATE OR DELETE ON public.training_live_meetings
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_training_schedules_from_lives();