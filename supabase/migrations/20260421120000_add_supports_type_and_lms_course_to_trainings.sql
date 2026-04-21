-- ============================================================
-- Training supports: type selector (url / file / lms) + LMS link
-- ============================================================
-- A training support is either:
--   - a URL (existing supports_url behavior)
--   - a file uploaded to training-documents storage (public URL stored in supports_url)
--   - a published LMS course (supports_lms_course_id)
-- Only one LMS course may be linked per training (column is 1:1).

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS supports_type TEXT NOT NULL DEFAULT 'url'
    CHECK (supports_type IN ('url', 'file', 'lms')),
  ADD COLUMN IF NOT EXISTS supports_file_name TEXT,
  ADD COLUMN IF NOT EXISTS supports_lms_course_id UUID
    REFERENCES public.lms_courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainings_supports_lms_course
  ON public.trainings (supports_lms_course_id)
  WHERE supports_lms_course_id IS NOT NULL;

-- ------------------------------------------------------------
-- Auto-enroll a participant in the training's LMS course when
-- the participant is added to a training that has one linked.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_enroll_participant_in_lms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  SELECT supports_lms_course_id
    INTO v_course_id
    FROM public.trainings
   WHERE id = NEW.training_id;

  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.lms_enrollments (course_id, learner_email)
    VALUES (v_course_id, lower(NEW.email))
    ON CONFLICT (course_id, learner_email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enroll_participant_lms
  ON public.training_participants;

CREATE TRIGGER trg_auto_enroll_participant_lms
  AFTER INSERT ON public.training_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_participant_in_lms();

-- ------------------------------------------------------------
-- When a training's LMS course is (re)assigned, retroactively
-- enroll all already-existing participants. Covers the common
-- case where the course is added after participants exist.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_enroll_existing_participants_in_lms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supports_lms_course_id IS NOT NULL
     AND NEW.supports_lms_course_id IS DISTINCT FROM OLD.supports_lms_course_id THEN
    INSERT INTO public.lms_enrollments (course_id, learner_email)
    SELECT NEW.supports_lms_course_id, lower(email)
      FROM public.training_participants
     WHERE training_id = NEW.id
       AND email IS NOT NULL
       AND email <> ''
    ON CONFLICT (course_id, learner_email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enroll_existing_participants_lms
  ON public.trainings;

CREATE TRIGGER trg_auto_enroll_existing_participants_lms
  AFTER UPDATE OF supports_lms_course_id ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_existing_participants_in_lms();
