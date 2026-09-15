CREATE OR REPLACE FUNCTION public.get_training_survey_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient record;
  v_survey record;
  v_trainer record;
  v_questions jsonb;
  v_existing_response record;
  v_existing_answers jsonb;
  v_closed boolean;
BEGIN
  SELECT * INTO v_recipient FROM public.training_survey_recipients WHERE token = p_token;
  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_survey FROM public.training_surveys WHERE id = v_recipient.survey_id;
  IF v_survey IS NULL OR v_survey.is_active = false THEN
    RETURN jsonb_build_object('error', 'inactive');
  END IF;

  SELECT tr.first_name, tr.last_name, tr.email
  INTO v_trainer
  FROM public.trainings t
  LEFT JOIN public.trainers tr ON tr.id = t.trainer_id
  WHERE t.id = v_survey.training_id;

  v_closed := v_survey.closes_at IS NOT NULL AND v_survey.closes_at < now();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'type', q.type,
    'label', q.label,
    'description', q.description,
    'required', q.required,
    'position', q.position,
    'options', q.options
  ) ORDER BY q.position), '[]'::jsonb)
  INTO v_questions
  FROM public.training_survey_questions q WHERE q.survey_id = v_survey.id;

  SELECT * INTO v_existing_response
    FROM public.training_survey_responses
    WHERE survey_id = v_survey.id AND recipient_id = v_recipient.id;

  IF v_existing_response IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'question_id', a.question_id,
      'value', a.value,
      'values', a.values
    )), '[]'::jsonb)
    INTO v_existing_answers
    FROM public.training_survey_answers a WHERE a.response_id = v_existing_response.id;
  ELSE
    v_existing_answers := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'survey', jsonb_build_object(
      'id', v_survey.id,
      'title', v_survey.title,
      'intro_message', v_survey.intro_message,
      'thank_you_message', v_survey.thank_you_message,
      'closes_at', v_survey.closes_at,
      'is_closed', v_closed
    ),
    'recipient', jsonb_build_object(
      'id', v_recipient.id,
      'first_name', v_recipient.first_name,
      'last_name', v_recipient.last_name,
      'email', v_recipient.email
    ),
    'trainer', CASE
      WHEN v_trainer.email IS NULL THEN NULL
      ELSE jsonb_build_object(
        'first_name', v_trainer.first_name,
        'last_name', v_trainer.last_name,
        'email', v_trainer.email
      )
    END,
    'questions', v_questions,
    'has_responded', v_existing_response IS NOT NULL,
    'previous_answers', v_existing_answers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_survey_by_token(uuid) TO anon, authenticated;