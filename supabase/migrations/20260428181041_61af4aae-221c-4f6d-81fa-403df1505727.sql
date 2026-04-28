CREATE OR REPLACE FUNCTION public.monitor_missing_evaluation_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created INTEGER := 0;
  v_alerted INTEGER := 0;
  v_alert_payload jsonb;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT DISTINCT
      t.id AS training_id,
      te.participant_id
    FROM trainings t
    JOIN training_evaluations te ON te.training_id = t.id
    WHERE t.is_cancelled = false
      AND t.start_date >= (now()::date - INTERVAL '30 days')
      AND t.start_date <= (now()::date - INTERVAL '1 day')
      AND te.etat = 'envoye'
      AND te.date_soumission IS NULL
      AND EXISTS (
        SELECT 1 FROM sent_emails_log sel
        WHERE sel.training_id = t.id
          AND sel.email_type = 'thank_you'
          AND sel.participant_id = te.participant_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_emails se
        WHERE se.training_id = t.id
          AND se.participant_id = te.participant_id
          AND se.email_type = 'evaluation_reminder_1'
      )
  LOOP
    INSERT INTO scheduled_emails (training_id, participant_id, email_type, scheduled_for, status)
    VALUES 
      (v_row.training_id, v_row.participant_id, 'evaluation_reminder_1', now(), 'pending'),
      (v_row.training_id, v_row.participant_id, 'evaluation_reminder_2', now() + INTERVAL '3 days', 'pending');

    v_created := v_created + 2;
    v_alerted := v_alerted + 1;
  END LOOP;

  IF v_alerted > 0 THEN
    v_alert_payload := jsonb_build_object(
      'subject', format('⚠️ %s rappel(s) d''évaluation manquant(s) auto-créé(s)', v_alerted),
      'message', format(
        '%s participant(s) n''avaient pas de evaluation_reminder_1 programmé alors que leur formation est passée et que le thank_you a été envoyé. Le système a auto-créé %s scheduled_emails. Vérifier send-thank-you-email pour comprendre la cause racine.',
        v_alerted, v_created
      ),
      'severity', 'warning',
      'context', 'monitor_missing_evaluation_reminders'
    );

    PERFORM net.http_post(
      url := 'https://yewffntzgrdgztrwtava.supabase.co/functions/v1/alert-form-error',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlld2ZmbnR6Z3JkZ3p0cnd0YXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODcxNDUsImV4cCI6MjA4MzQ2MzE0NX0.Gugre6DaysctfwgBEIg_OQlgngDJqIl1l6ulwCUfgJE'
      ),
      body := v_alert_payload
    );
  END IF;

  RETURN jsonb_build_object(
    'reminders_created', v_created,
    'participants_fixed', v_alerted,
    'checked_at', now()
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-missing-evaluation-reminders') THEN
    PERFORM cron.unschedule('monitor-missing-evaluation-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'monitor-missing-evaluation-reminders',
  '30 6 * * *',
  $$ SELECT public.monitor_missing_evaluation_reminders(); $$
);