-- Trigger to keep missions.consumed_amount and missions.billed_amount
-- in sync with the sum of mission_activities.billable_amount.
--
-- consumed_amount = sum of ALL activities' billable_amount
-- billed_amount   = sum of activities' billable_amount WHERE is_billed = true

CREATE OR REPLACE FUNCTION sync_mission_amounts()
RETURNS trigger AS $$
DECLARE
  target_mission_id uuid;
BEGIN
  -- Determine which mission to update
  IF TG_OP = 'DELETE' THEN
    target_mission_id := OLD.mission_id;
  ELSE
    target_mission_id := NEW.mission_id;
  END IF;

  UPDATE public.missions
  SET
    consumed_amount = COALESCE((
      SELECT SUM(billable_amount)
      FROM public.mission_activities
      WHERE mission_id = target_mission_id
    ), 0),
    billed_amount = COALESCE((
      SELECT SUM(billable_amount)
      FROM public.mission_activities
      WHERE mission_id = target_mission_id AND is_billed = true
    ), 0)
  WHERE id = target_mission_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire after any change to mission_activities
CREATE TRIGGER trg_sync_mission_amounts
  AFTER INSERT OR UPDATE OR DELETE ON public.mission_activities
  FOR EACH ROW EXECUTE FUNCTION sync_mission_amounts();

-- Backfill existing data so current missions get correct amounts
UPDATE public.missions m
SET
  consumed_amount = COALESCE(agg.consumed, 0),
  billed_amount   = COALESCE(agg.billed, 0)
FROM (
  SELECT
    mission_id,
    SUM(billable_amount) AS consumed,
    SUM(CASE WHEN is_billed THEN billable_amount ELSE 0 END) AS billed
  FROM public.mission_activities
  GROUP BY mission_id
) agg
WHERE m.id = agg.mission_id;
