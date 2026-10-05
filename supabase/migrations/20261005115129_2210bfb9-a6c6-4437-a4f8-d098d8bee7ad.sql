CREATE OR REPLACE FUNCTION public.lms_enrollment_removal_decision(
  _course_id uuid, _email text, _exclude_participant_id uuid DEFAULT NULL, _repositioned_to uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_enrollment uuid;
  v_other text;
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

  RETURN jsonb_build_object('action', 'remove', 'enrollment_id', v_enrollment,
    'reason', 'Aucune autre session reliée à ce cours ni repositionnement vers une telle session');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lms_enrollment_removal_decision(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lms_enrollment_removal_decision(uuid, text, uuid, uuid) TO service_role;