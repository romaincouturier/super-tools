-- Décision unique (UI, MCP, tout chemin de suppression) : faut-il retirer l'accès e-learning ?
CREATE OR REPLACE FUNCTION public.lms_enrollment_removal_decision(
  _course_id uuid, _email text, _exclude_participant_id uuid DEFAULT NULL, _repositioned_to uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_enrollment uuid;
  v_other text;
  v_access text;
BEGIN
  IF _course_id IS NULL OR v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('action', 'none', 'reason', 'Session sans cours e-learning rattaché');
  END IF;
  SELECT id INTO v_enrollment FROM lms_enrollments
   WHERE course_id = _course_id AND lower(learner_email) = v_email LIMIT 1;
  IF v_enrollment IS NULL THEN
    RETURN jsonb_build_object('action', 'none', 'reason', 'Aucune inscription e-learning sur ce cours');
  END IF;

  IF _repositioned_to IS NOT NULL AND EXISTS (
    SELECT 1 FROM trainings WHERE id = _repositioned_to AND supports_lms_course_id = _course_id
  ) THEN
    RETURN jsonb_build_object('action', 'keep', 'enrollment_id', v_enrollment,
      'reason', 'Participant repositionné vers une session reliée au même cours');
  END IF;

  SELECT t.training_name || coalesce(' (' || t.start_date::text || ')', '') INTO v_other
    FROM training_participants tp
    JOIN trainings t ON t.id = tp.training_id
   WHERE lower(tp.email) = v_email
     AND t.supports_lms_course_id = _course_id
     AND (_exclude_participant_id IS NULL OR tp.id <> _exclude_participant_id)
     AND (tp.repositioned_to_training_id IS NULL OR EXISTS (
       SELECT 1 FROM trainings d WHERE d.id = tp.repositioned_to_training_id AND d.supports_lms_course_id = _course_id))
   LIMIT 1;
  IF v_other IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'keep', 'enrollment_id', v_enrollment,
      'reason', 'Encore participant d''une autre session reliée au même cours : ' || v_other);
  END IF;

  SELECT access_type INTO v_access FROM lms_courses WHERE id = _course_id;
  IF v_access = 'gratuit' THEN
    RETURN jsonb_build_object('action', 'keep', 'enrollment_id', v_enrollment,
      'reason', 'Cours en accès libre (Academy) : l''inscription peut venir d''une inscription directe');
  END IF;

  RETURN jsonb_build_object('action', 'remove', 'enrollment_id', v_enrollment,
    'reason', 'Aucune autre session ni autre droit d''accès à ce cours');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lms_enrollment_removal_decision(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lms_enrollment_removal_decision(uuid, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.unenroll_lms_after_participant_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_course uuid;
  v_name text;
  v_decision jsonb;
  v_actor text := coalesce(auth.jwt() ->> 'email', 'systeme@supertools');
BEGIN
  SELECT supports_lms_course_id INTO v_course FROM trainings WHERE id = OLD.training_id;
  IF v_course IS NULL OR OLD.email IS NULL THEN RETURN OLD; END IF;
  v_decision := lms_enrollment_removal_decision(v_course, OLD.email, OLD.id, OLD.repositioned_to_training_id);
  IF v_decision ->> 'action' = 'none' THEN RETURN OLD; END IF;
  SELECT title INTO v_name FROM lms_courses WHERE id = v_course;

  IF v_decision ->> 'action' = 'remove' THEN
    DELETE FROM lms_enrollments WHERE id = (v_decision ->> 'enrollment_id')::uuid;
  END IF;

  INSERT INTO training_actions (training_id, description, due_date, assigned_user_email, status, completed_at)
  VALUES (OLD.training_id,
    left(CASE WHEN v_decision ->> 'action' = 'remove'
      THEN 'Accès e-learning supprimé pour ' || OLD.email || ' (cours « ' || coalesce(v_name, '?') || ' »)'
      ELSE 'Accès e-learning conservé pour ' || OLD.email || ' (cours « ' || coalesce(v_name, '?') || ' ») : ' || (v_decision ->> 'reason') END, 1000),
    (now() AT TIME ZONE 'Europe/Paris')::date, v_actor, 'completed', now());
  INSERT INTO activity_logs (action_type, recipient_email, details)
  VALUES (CASE WHEN v_decision ->> 'action' = 'remove' THEN 'lms_access_removed' ELSE 'lms_access_kept' END,
    lower(OLD.email),
    jsonb_build_object('training_id', OLD.training_id, 'course_id', v_course, 'reason', v_decision ->> 'reason', 'via', 'participant_removed'));
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unenroll_lms_after_participant_removal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_unenroll_lms_after_participant_removal
AFTER DELETE ON public.training_participants
FOR EACH ROW EXECUTE FUNCTION public.unenroll_lms_after_participant_removal();