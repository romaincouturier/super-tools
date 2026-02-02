-- Add sponsor feedback email type for Qualiopi compliance
-- This email is sent to the training sponsor X days after the training ends

-- 1. Modify the scheduled_emails table to accept new email types
-- First drop and recreate the constraint with new types
ALTER TABLE public.scheduled_emails
DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;

ALTER TABLE public.scheduled_emails
ADD CONSTRAINT scheduled_emails_email_type_check
CHECK (email_type IN (
  'needs_survey',
  'reminder_j7',
  'needs_summary',
  'thank_you',
  'relance',
  'sponsor_feedback',      -- New: feedback request to sponsor after training
  'evaluation_reminder',   -- New: evaluation reminder (J+2, J+4)
  'cold_evaluation'        -- New: cold evaluation (J+20)
));

-- 2. Add sponsor feedback tracking columns to trainings table
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS sponsor_feedback_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sponsor_feedback_response TEXT,
ADD COLUMN IF NOT EXISTS sponsor_feedback_score INTEGER CHECK (sponsor_feedback_score BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS sponsor_feedback_received_at TIMESTAMPTZ;

-- 3. Create a configuration table for sponsor feedback delay
CREATE TABLE IF NOT EXISTS public.email_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default configuration
INSERT INTO public.email_config (config_key, config_value, description) VALUES
('sponsor_feedback_delay_days', '7', 'Number of days after training end to send sponsor feedback request'),
('evaluation_reminder_1_days', '2', 'First evaluation reminder delay in days'),
('evaluation_reminder_2_days', '4', 'Second evaluation reminder delay in days'),
('cold_evaluation_delay_days', '20', 'Cold evaluation email delay in days')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view config
CREATE POLICY "Authenticated users can view email config"
ON public.email_config FOR SELECT TO authenticated
USING (true);

-- Only authenticated users can update config
CREATE POLICY "Authenticated users can update email config"
ON public.email_config FOR UPDATE TO authenticated
USING (true);

-- 4. Create function to schedule sponsor feedback email
CREATE OR REPLACE FUNCTION public.schedule_sponsor_feedback_email(p_training_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_training RECORD;
  v_delay_days INTEGER;
  v_scheduled_for TIMESTAMPTZ;
  v_existing_email UUID;
  v_new_email_id UUID;
BEGIN
  -- Get training details
  SELECT * INTO v_training FROM trainings WHERE id = p_training_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Training not found');
  END IF;

  -- Check if sponsor email exists
  IF v_training.sponsor_email IS NULL OR v_training.sponsor_email = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No sponsor email configured');
  END IF;

  -- Get delay configuration
  SELECT config_value::INTEGER INTO v_delay_days
  FROM email_config
  WHERE config_key = 'sponsor_feedback_delay_days';

  IF v_delay_days IS NULL THEN
    v_delay_days := 7; -- Default to 7 days
  END IF;

  -- Calculate scheduled date (end_date + delay, or start_date + delay if no end_date)
  v_scheduled_for := (COALESCE(v_training.end_date, v_training.start_date) + (v_delay_days || ' days')::INTERVAL)::DATE + TIME '09:00:00';

  -- Check if already scheduled
  SELECT id INTO v_existing_email
  FROM scheduled_emails
  WHERE training_id = p_training_id
    AND email_type = 'sponsor_feedback'
    AND status = 'pending';

  IF v_existing_email IS NOT NULL THEN
    -- Update existing scheduled email
    UPDATE scheduled_emails
    SET scheduled_for = v_scheduled_for
    WHERE id = v_existing_email;

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'updated',
      'email_id', v_existing_email,
      'scheduled_for', v_scheduled_for
    );
  END IF;

  -- Create new scheduled email
  INSERT INTO scheduled_emails (
    training_id,
    participant_id,
    email_type,
    scheduled_for,
    status
  ) VALUES (
    p_training_id,
    NULL, -- No participant, this is for sponsor
    'sponsor_feedback',
    v_scheduled_for,
    'pending'
  ) RETURNING id INTO v_new_email_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', 'created',
    'email_id', v_new_email_id,
    'scheduled_for', v_scheduled_for,
    'delay_days', v_delay_days
  );
END;
$$;

-- 5. Create trigger to auto-schedule sponsor feedback when training is created/updated
CREATE OR REPLACE FUNCTION public.trigger_schedule_sponsor_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only schedule if sponsor email is set and training has an end date
  IF NEW.sponsor_email IS NOT NULL AND NEW.sponsor_email != '' THEN
    -- Only schedule for future trainings or trainings that just ended
    IF COALESCE(NEW.end_date, NEW.start_date) >= CURRENT_DATE - INTERVAL '7 days' THEN
      PERFORM schedule_sponsor_feedback_email(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_schedule_sponsor_feedback_on_training ON public.trainings;

CREATE TRIGGER trigger_schedule_sponsor_feedback_on_training
AFTER INSERT OR UPDATE OF sponsor_email, end_date, start_date
ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION trigger_schedule_sponsor_feedback();

-- 6. Comment for documentation
COMMENT ON FUNCTION public.schedule_sponsor_feedback_email IS
'Schedules a sponsor feedback request email X days after training end (Qualiopi compliance)';

COMMENT ON TABLE public.email_config IS
'Configuration for automated email timing and behavior';
