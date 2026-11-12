CREATE OR REPLACE FUNCTION public.normalize_person_name(v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN btrim(v) = '' THEN v
    WHEN v = upper(v) OR v = lower(v) THEN initcap(regexp_replace(btrim(v), '\s+', ' ', 'g'))
    ELSE btrim(v)
  END
$$;

CREATE OR REPLACE FUNCTION public.normalize_training_participant_names()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.first_name := public.normalize_person_name(NEW.first_name);
  NEW.last_name := public.normalize_person_name(NEW.last_name);
  NEW.sponsor_first_name := public.normalize_person_name(NEW.sponsor_first_name);
  NEW.sponsor_last_name := public.normalize_person_name(NEW.sponsor_last_name);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_training_participant_names ON public.training_participants;
CREATE TRIGGER trg_normalize_training_participant_names
BEFORE INSERT OR UPDATE OF first_name, last_name, sponsor_first_name, sponsor_last_name
ON public.training_participants
FOR EACH ROW EXECUTE FUNCTION public.normalize_training_participant_names();

UPDATE public.training_participants
SET first_name = public.normalize_person_name(first_name),
    last_name = public.normalize_person_name(last_name),
    sponsor_first_name = public.normalize_person_name(sponsor_first_name),
    sponsor_last_name = public.normalize_person_name(sponsor_last_name)
WHERE first_name IS DISTINCT FROM public.normalize_person_name(first_name)
   OR last_name IS DISTINCT FROM public.normalize_person_name(last_name)
   OR sponsor_first_name IS DISTINCT FROM public.normalize_person_name(sponsor_first_name)
   OR sponsor_last_name IS DISTINCT FROM public.normalize_person_name(sponsor_last_name);