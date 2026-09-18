CREATE OR REPLACE FUNCTION public.sync_learner_profile_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.learner_profiles (email, first_name, last_name, updated_at)
  VALUES (
    lower(trim(NEW.email)),
    nullif(trim(coalesce(NEW.first_name, '')), ''),
    nullif(trim(coalesce(NEW.last_name, '')), ''),
    now()
  )
  ON CONFLICT (email) DO UPDATE
  SET first_name = coalesce(nullif(trim(coalesce(public.learner_profiles.first_name, '')), ''), EXCLUDED.first_name),
      last_name = coalesce(nullif(trim(coalesce(public.learner_profiles.last_name, '')), ''), EXCLUDED.last_name),
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_learner_profile_name ON public.training_participants;

CREATE TRIGGER trg_sync_learner_profile_name
AFTER INSERT OR UPDATE OF email, first_name, last_name ON public.training_participants
FOR EACH ROW
EXECUTE FUNCTION public.sync_learner_profile_name();