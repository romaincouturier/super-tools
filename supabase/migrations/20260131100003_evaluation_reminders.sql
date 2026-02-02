-- Automatic evaluation reminders scheduling
-- Sends reminder emails at J+2 and J+4 if participant hasn't submitted evaluation

-- Add reminder tracking to training_evaluations
ALTER TABLE public.training_evaluations
ADD COLUMN IF NOT EXISTS reminder_1_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_2_sent_at TIMESTAMPTZ;

-- Function to schedule evaluation reminders for a training
CREATE OR REPLACE FUNCTION public.schedule_evaluation_reminders(p_training_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_training RECORD;
  v_participant RECORD;
  v_end_date DATE;
  v_reminder_1_date TIMESTAMPTZ;
  v_reminder_2_date TIMESTAMPTZ;
  v_scheduled_count INTEGER := 0;
  v_delay_1 INTEGER;
  v_delay_2 INTEGER;
BEGIN
  -- Get training
  SELECT * INTO v_training FROM trainings WHERE id = p_training_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Training not found');
  END IF;

  -- Get end date
  v_end_date := COALESCE(v_training.end_date, v_training.start_date);

  -- Get delay configuration
  SELECT COALESCE(config_value::INTEGER, 2) INTO v_delay_1
  FROM email_config WHERE config_key = 'evaluation_reminder_1_days';

  SELECT COALESCE(config_value::INTEGER, 4) INTO v_delay_2
  FROM email_config WHERE config_key = 'evaluation_reminder_2_days';

  -- Calculate reminder dates
  v_reminder_1_date := (v_end_date + (v_delay_1 || ' days')::INTERVAL)::DATE + TIME '10:00:00';
  v_reminder_2_date := (v_end_date + (v_delay_2 || ' days')::INTERVAL)::DATE + TIME '10:00:00';

  -- Only schedule if dates are in the future
  IF v_reminder_1_date <= now() AND v_reminder_2_date <= now() THEN
    RETURN jsonb_build_object('success', TRUE, 'message', 'Reminders already past', 'scheduled', 0);
  END IF;

  -- Schedule reminders for each participant
  FOR v_participant IN
    SELECT id, email FROM training_participants WHERE training_id = p_training_id
  LOOP
    -- Check if participant already submitted evaluation
    IF EXISTS (
      SELECT 1 FROM training_evaluations
      WHERE training_id = p_training_id
        AND participant_id = v_participant.id
        AND etat = 'soumis'
    ) THEN
      CONTINUE;
    END IF;

    -- Schedule reminder 1 (J+2)
    IF v_reminder_1_date > now() THEN
      INSERT INTO scheduled_emails (
        training_id, participant_id, email_type, scheduled_for, status
      )
      SELECT
        p_training_id, v_participant.id, 'evaluation_reminder', v_reminder_1_date, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM scheduled_emails
        WHERE training_id = p_training_id
          AND participant_id = v_participant.id
          AND email_type = 'evaluation_reminder'
          AND scheduled_for = v_reminder_1_date
          AND status = 'pending'
      );

      IF FOUND THEN
        v_scheduled_count := v_scheduled_count + 1;
      END IF;
    END IF;

    -- Schedule reminder 2 (J+4)
    IF v_reminder_2_date > now() THEN
      INSERT INTO scheduled_emails (
        training_id, participant_id, email_type, scheduled_for, status
      )
      SELECT
        p_training_id, v_participant.id, 'evaluation_reminder', v_reminder_2_date, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM scheduled_emails
        WHERE training_id = p_training_id
          AND participant_id = v_participant.id
          AND email_type = 'evaluation_reminder'
          AND scheduled_for = v_reminder_2_date
          AND status = 'pending'
      );

      IF FOUND THEN
        v_scheduled_count := v_scheduled_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'training_id', p_training_id,
    'reminder_1_date', v_reminder_1_date,
    'reminder_2_date', v_reminder_2_date,
    'scheduled_count', v_scheduled_count
  );
END;
$$;

-- Trigger to auto-schedule evaluation reminders when thank_you email is sent
CREATE OR REPLACE FUNCTION public.trigger_schedule_eval_reminders_on_thank_you()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When thank_you email is sent, schedule evaluation reminders
  IF NEW.email_type = 'thank_you' AND NEW.status = 'sent' AND OLD.status = 'pending' THEN
    PERFORM schedule_evaluation_reminders(NEW.training_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_schedule_eval_reminders ON public.scheduled_emails;

CREATE TRIGGER trigger_schedule_eval_reminders
AFTER UPDATE OF status ON public.scheduled_emails
FOR EACH ROW
WHEN (NEW.email_type = 'thank_you' AND NEW.status = 'sent')
EXECUTE FUNCTION trigger_schedule_eval_reminders_on_thank_you();

-- Comment for documentation
COMMENT ON FUNCTION public.schedule_evaluation_reminders IS
'Schedules evaluation reminder emails at J+2 and J+4 for all participants who havent submitted';
