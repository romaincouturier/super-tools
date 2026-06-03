-- ============================================================
-- Training surveys system
-- ============================================================

-- 1. SURVEYS
CREATE TABLE public.training_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sondage',
  intro_message text,
  email_subject text,
  email_body text,
  thank_you_message text NOT NULL DEFAULT 'Merci pour vos réponses !',
  closes_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_surveys_training ON public.training_surveys(training_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_surveys TO authenticated;
GRANT ALL ON public.training_surveys TO service_role;

ALTER TABLE public.training_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read training surveys"
  ON public.training_surveys FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff can insert training surveys"
  ON public.training_surveys FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff can update training surveys"
  ON public.training_surveys FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));
CREATE POLICY "Staff can delete training surveys"
  ON public.training_surveys FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 2. QUESTIONS
CREATE TABLE public.training_survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.training_surveys(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text','textarea','single_choice','multiple_choice','rating','nps','date')),
  label text NOT NULL DEFAULT '',
  description text,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  options jsonb,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_survey_questions_survey ON public.training_survey_questions(survey_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_survey_questions TO authenticated;
GRANT ALL ON public.training_survey_questions TO service_role;

ALTER TABLE public.training_survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage training survey questions"
  ON public.training_survey_questions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 3. RECIPIENTS (1 par participant avec token unique)
CREATE TABLE public.training_survey_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.training_surveys(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.training_participants(id) ON DELETE SET NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  sent_at timestamptz,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token),
  UNIQUE (survey_id, participant_id)
);
CREATE INDEX idx_training_survey_recipients_survey ON public.training_survey_recipients(survey_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_survey_recipients TO authenticated;
GRANT ALL ON public.training_survey_recipients TO service_role;

ALTER TABLE public.training_survey_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage training survey recipients"
  ON public.training_survey_recipients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 4. RESPONSES (1 par recipient, modifiable)
CREATE TABLE public.training_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.training_surveys(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.training_survey_recipients(id) ON DELETE CASCADE,
  respondent_name text,
  respondent_email text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, recipient_id)
);
CREATE INDEX idx_training_survey_responses_survey ON public.training_survey_responses(survey_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_survey_responses TO authenticated;
GRANT ALL ON public.training_survey_responses TO service_role;

ALTER TABLE public.training_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read training survey responses"
  ON public.training_survey_responses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 5. ANSWERS
CREATE TABLE public.training_survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.training_survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.training_survey_questions(id) ON DELETE CASCADE,
  value text,
  values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_survey_answers_response ON public.training_survey_answers(response_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_survey_answers TO authenticated;
GRANT ALL ON public.training_survey_answers TO service_role;

ALTER TABLE public.training_survey_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read training survey answers"
  ON public.training_survey_answers FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'));

-- 6. Trigger updated_at on surveys
CREATE TRIGGER update_training_surveys_updated_at
  BEFORE UPDATE ON public.training_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_survey_responses_updated_at
  BEFORE UPDATE ON public.training_survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PUBLIC RPCs (SECURITY DEFINER) for survey response page
-- ============================================================

-- Get survey + questions + existing answers by token
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
    'questions', v_questions,
    'has_responded', v_existing_response IS NOT NULL,
    'previous_answers', v_existing_answers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_training_survey_by_token(uuid) TO anon, authenticated;

-- Submit (or update) survey response
CREATE OR REPLACE FUNCTION public.submit_training_survey(p_token uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient record;
  v_survey record;
  v_response_id uuid;
  v_answer jsonb;
BEGIN
  SELECT * INTO v_recipient FROM public.training_survey_recipients WHERE token = p_token;
  IF v_recipient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_survey FROM public.training_surveys WHERE id = v_recipient.survey_id;
  IF v_survey IS NULL OR v_survey.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'inactive');
  END IF;

  IF v_survey.closes_at IS NOT NULL AND v_survey.closes_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'closed');
  END IF;

  -- Upsert response
  INSERT INTO public.training_survey_responses (survey_id, recipient_id, respondent_name, respondent_email)
  VALUES (
    v_survey.id,
    v_recipient.id,
    trim(coalesce(v_recipient.first_name,'') || ' ' || coalesce(v_recipient.last_name,'')),
    v_recipient.email
  )
  ON CONFLICT (survey_id, recipient_id)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_response_id;

  -- Replace answers
  DELETE FROM public.training_survey_answers WHERE response_id = v_response_id;

  IF jsonb_typeof(p_answers) = 'array' THEN
    FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
      INSERT INTO public.training_survey_answers (response_id, question_id, value, values)
      VALUES (
        v_response_id,
        (v_answer->>'question_id')::uuid,
        NULLIF(v_answer->>'value', ''),
        CASE WHEN jsonb_typeof(v_answer->'values') = 'array' THEN v_answer->'values' ELSE NULL END
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'response_id', v_response_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_training_survey(uuid, jsonb) TO anon, authenticated;