-- Learner magic link tokens
CREATE TABLE public.learner_magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_learner_magic_links_token ON public.learner_magic_links(token);
CREATE INDEX idx_learner_magic_links_email ON public.learner_magic_links(email);

ALTER TABLE public.learner_magic_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can request magic link" ON public.learner_magic_links
  FOR INSERT TO anon WITH CHECK (true);

-- Security definer function to validate token and return participant data
CREATE OR REPLACE FUNCTION public.validate_learner_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link learner_magic_links;
  v_email text;
  v_result json;
BEGIN
  SELECT * INTO v_link FROM learner_magic_links WHERE token = p_token AND used_at IS NULL LIMIT 1;
  
  IF v_link IS NULL THEN
    RETURN json_build_object('status', 'invalid');
  END IF;
  
  IF v_link.expires_at < now() THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  v_email := v_link.email;
  
  UPDATE learner_magic_links SET used_at = now() WHERE id = v_link.id;

  SELECT json_build_object(
    'status', 'ok',
    'email', v_email,
    'trainings', COALESCE((
      SELECT json_agg(json_build_object(
        'training_id', t.id,
        'training_name', t.training_name,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'location', t.location,
        'format', t.format_formation,
        'participant_id', tp.id,
        'first_name', tp.first_name,
        'last_name', tp.last_name,
        'needs_survey_status', tp.needs_survey_status,
        'evaluation_status', tp.evaluation_status
      ) ORDER BY t.start_date DESC)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(v_email)
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Function to get learner data by email (for session persistence)
CREATE OR REPLACE FUNCTION public.get_learner_portal_data(p_email text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN json_build_object(
    'email', p_email,
    'trainings', COALESCE((
      SELECT json_agg(json_build_object(
        'training_id', t.id,
        'training_name', t.training_name,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'location', t.location,
        'format', t.format_formation,
        'participant_id', tp.id,
        'first_name', tp.first_name,
        'last_name', tp.last_name,
        'needs_survey_status', tp.needs_survey_status,
        'evaluation_status', tp.evaluation_status,
        'program_file_url', t.program_file_url,
        'supports_url', t.supports_url
      ) ORDER BY t.start_date DESC)
      FROM training_participants tp
      JOIN trainings t ON t.id = tp.training_id
      WHERE lower(tp.email) = lower(p_email)
    ), '[]'::json),
    'questionnaires', COALESCE((
      SELECT json_agg(json_build_object(
        'token', q.token,
        'training_id', q.training_id,
        'etat', q.etat
      ))
      FROM questionnaire_besoins q
      WHERE lower(q.email) = lower(p_email)
    ), '[]'::json),
    'evaluations', COALESCE((
      SELECT json_agg(json_build_object(
        'token', e.token,
        'training_id', e.training_id,
        'etat', e.etat
      ))
      FROM training_evaluations e
      WHERE lower(e.email) = lower(p_email)
    ), '[]'::json)
  );
END;
$$;