-- RGPD Data Cleanup System
-- Implements automatic purge of personal data after 3 years (Qualiopi compliance)

-- Create table to track RGPD cleanup history
CREATE TABLE IF NOT EXISTS public.rgpd_cleanup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleanup_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  cutoff_date DATE NOT NULL,
  trainings_anonymized INTEGER DEFAULT 0,
  participants_anonymized INTEGER DEFAULT 0,
  questionnaires_deleted INTEGER DEFAULT 0,
  evaluations_anonymized INTEGER DEFAULT 0,
  signatures_deleted INTEGER DEFAULT 0,
  emails_purged INTEGER DEFAULT 0,
  executed_by TEXT,
  execution_mode TEXT CHECK (execution_mode IN ('manual', 'automatic')),
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.rgpd_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view cleanup logs
CREATE POLICY "Authenticated users can view cleanup logs"
ON public.rgpd_cleanup_logs
FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users can insert cleanup logs
CREATE POLICY "Authenticated users can insert cleanup logs"
ON public.rgpd_cleanup_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add anonymization columns to trainings table
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Add anonymization columns to training_participants table
ALTER TABLE public.training_participants
ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Add anonymization columns to training_evaluations table
ALTER TABLE public.training_evaluations
ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Create function to get trainings eligible for RGPD cleanup
-- Trainings older than 3 years from end_date (or start_date if no end_date)
CREATE OR REPLACE FUNCTION public.get_rgpd_eligible_trainings(cutoff_years INTEGER DEFAULT 3)
RETURNS TABLE (
  training_id UUID,
  training_name TEXT,
  client_name TEXT,
  end_date DATE,
  participants_count BIGINT,
  days_since_end INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS training_id,
    t.training_name,
    t.client_name,
    COALESCE(t.end_date, t.start_date) AS end_date,
    COUNT(tp.id) AS participants_count,
    (CURRENT_DATE - COALESCE(t.end_date, t.start_date))::INTEGER AS days_since_end
  FROM trainings t
  LEFT JOIN training_participants tp ON tp.training_id = t.id
  WHERE
    t.is_anonymized = FALSE
    AND COALESCE(t.end_date, t.start_date) < (CURRENT_DATE - (cutoff_years * INTERVAL '1 year'))::DATE
  GROUP BY t.id, t.training_name, t.client_name, t.end_date, t.start_date
  ORDER BY COALESCE(t.end_date, t.start_date) ASC;
END;
$$;

-- Create function to anonymize a single training and its related data
CREATE OR REPLACE FUNCTION public.anonymize_training(p_training_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participants_count INTEGER := 0;
  v_questionnaires_count INTEGER := 0;
  v_evaluations_count INTEGER := 0;
  v_signatures_count INTEGER := 0;
  v_emails_count INTEGER := 0;
  v_training_name TEXT;
BEGIN
  -- Get training name for the result
  SELECT training_name INTO v_training_name FROM trainings WHERE id = p_training_id;

  -- 1. Delete questionnaire responses (personal data)
  DELETE FROM questionnaire_besoins WHERE training_id = p_training_id;
  GET DIAGNOSTICS v_questionnaires_count = ROW_COUNT;

  -- 2. Delete questionnaire events
  DELETE FROM questionnaire_events
  WHERE questionnaire_id IN (
    SELECT id FROM questionnaire_besoins WHERE training_id = p_training_id
  );

  -- 3. Anonymize evaluations (keep ratings, remove personal comments)
  UPDATE training_evaluations
  SET
    amelioration_suggeree = NULL,
    freins_application = NULL,
    is_anonymized = TRUE,
    anonymized_at = now()
  WHERE training_id = p_training_id AND is_anonymized = FALSE;
  GET DIAGNOSTICS v_evaluations_count = ROW_COUNT;

  -- 4. Delete attendance signatures (contains personal data: signature image, IP)
  DELETE FROM attendance_signatures WHERE training_id = p_training_id;
  GET DIAGNOSTICS v_signatures_count = ROW_COUNT;

  -- 5. Anonymize participants (keep anonymized record for statistics)
  UPDATE training_participants
  SET
    first_name = 'Anonyme',
    last_name = NULL,
    email = 'anonyme-' || id::text || '@rgpd-purge.local',
    company = NULL,
    needs_survey_token = NULL,
    is_anonymized = TRUE,
    anonymized_at = now()
  WHERE training_id = p_training_id AND is_anonymized = FALSE;
  GET DIAGNOSTICS v_participants_count = ROW_COUNT;

  -- 6. Delete scheduled emails for this training
  DELETE FROM scheduled_emails WHERE training_id = p_training_id;
  GET DIAGNOSTICS v_emails_count = ROW_COUNT;

  -- 7. Anonymize training sponsor info
  UPDATE trainings
  SET
    sponsor_first_name = 'Anonyme',
    sponsor_last_name = NULL,
    sponsor_email = 'anonyme@rgpd-purge.local',
    is_anonymized = TRUE,
    anonymized_at = now()
  WHERE id = p_training_id;

  -- 8. Clean activity logs for this training (remove email content, keep structure)
  UPDATE activity_logs
  SET details = details - 'email_content' - 'participant_name' - 'recipient_email'
  WHERE details->>'training_id' = p_training_id::text;

  RETURN jsonb_build_object(
    'training_id', p_training_id,
    'training_name', v_training_name,
    'participants_anonymized', v_participants_count,
    'questionnaires_deleted', v_questionnaires_count,
    'evaluations_anonymized', v_evaluations_count,
    'signatures_deleted', v_signatures_count,
    'emails_purged', v_emails_count,
    'anonymized_at', now()
  );
END;
$$;

-- Create function to run full RGPD cleanup
CREATE OR REPLACE FUNCTION public.run_rgpd_cleanup(
  p_cutoff_years INTEGER DEFAULT 3,
  p_execution_mode TEXT DEFAULT 'manual',
  p_executed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_training RECORD;
  v_result JSONB;
  v_total_trainings INTEGER := 0;
  v_total_participants INTEGER := 0;
  v_total_questionnaires INTEGER := 0;
  v_total_evaluations INTEGER := 0;
  v_total_signatures INTEGER := 0;
  v_total_emails INTEGER := 0;
  v_cutoff_date DATE;
  v_details JSONB := '[]'::jsonb;
  v_log_id UUID;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := (CURRENT_DATE - (p_cutoff_years * INTERVAL '1 year'))::DATE;

  -- Process each eligible training
  FOR v_training IN
    SELECT training_id FROM get_rgpd_eligible_trainings(p_cutoff_years)
  LOOP
    v_result := anonymize_training(v_training.training_id);

    v_total_trainings := v_total_trainings + 1;
    v_total_participants := v_total_participants + COALESCE((v_result->>'participants_anonymized')::INTEGER, 0);
    v_total_questionnaires := v_total_questionnaires + COALESCE((v_result->>'questionnaires_deleted')::INTEGER, 0);
    v_total_evaluations := v_total_evaluations + COALESCE((v_result->>'evaluations_anonymized')::INTEGER, 0);
    v_total_signatures := v_total_signatures + COALESCE((v_result->>'signatures_deleted')::INTEGER, 0);
    v_total_emails := v_total_emails + COALESCE((v_result->>'emails_purged')::INTEGER, 0);

    v_details := v_details || v_result;
  END LOOP;

  -- Log the cleanup operation
  INSERT INTO rgpd_cleanup_logs (
    cutoff_date,
    trainings_anonymized,
    participants_anonymized,
    questionnaires_deleted,
    evaluations_anonymized,
    signatures_deleted,
    emails_purged,
    executed_by,
    execution_mode,
    details
  ) VALUES (
    v_cutoff_date,
    v_total_trainings,
    v_total_participants,
    v_total_questionnaires,
    v_total_evaluations,
    v_total_signatures,
    v_total_emails,
    p_executed_by,
    p_execution_mode,
    jsonb_build_object('trainings', v_details)
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'log_id', v_log_id,
    'cutoff_date', v_cutoff_date,
    'trainings_anonymized', v_total_trainings,
    'participants_anonymized', v_total_participants,
    'questionnaires_deleted', v_total_questionnaires,
    'evaluations_anonymized', v_total_evaluations,
    'signatures_deleted', v_total_signatures,
    'emails_purged', v_total_emails
  );
END;
$$;

-- Create index for faster anonymization status queries
CREATE INDEX IF NOT EXISTS idx_trainings_anonymized ON public.trainings(is_anonymized) WHERE is_anonymized = FALSE;
CREATE INDEX IF NOT EXISTS idx_participants_anonymized ON public.training_participants(is_anonymized) WHERE is_anonymized = FALSE;
CREATE INDEX IF NOT EXISTS idx_evaluations_anonymized ON public.training_evaluations(is_anonymized) WHERE is_anonymized = FALSE;

-- Comment on functions
COMMENT ON FUNCTION public.get_rgpd_eligible_trainings IS 'Returns trainings eligible for RGPD cleanup (older than cutoff_years)';
COMMENT ON FUNCTION public.anonymize_training IS 'Anonymizes a single training and all related personal data';
COMMENT ON FUNCTION public.run_rgpd_cleanup IS 'Runs full RGPD cleanup on all eligible trainings';
COMMENT ON TABLE public.rgpd_cleanup_logs IS 'Audit log of RGPD data cleanup operations';
