-- A appliquer AVANT de déployer process-live-reminders et force-send-scheduled-email.
-- Un seul rappel de live par (live, participant), quel que soit le déclencheur.
CREATE TABLE public.live_reminder_sends (
  live_meeting_id uuid NOT NULL REFERENCES public.training_live_meetings(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (live_meeting_id, participant_id)
);

GRANT ALL ON public.live_reminder_sends TO service_role;
GRANT SELECT ON public.live_reminder_sends TO authenticated;

ALTER TABLE public.live_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read live reminder sends"
  ON public.live_reminder_sends FOR SELECT TO authenticated
  USING (public.is_admin());

-- Historique : envois du cron quotidien (clé activity_logs '<live>:<participant>')
INSERT INTO public.live_reminder_sends (live_meeting_id, participant_id, source, created_at)
SELECT split_part(a.recipient_email, ':', 1)::uuid, split_part(a.recipient_email, ':', 2)::uuid, 'process-live-reminders', min(a.created_at)
FROM public.activity_logs a
WHERE a.action_type = 'live_reminder_participant_sent'
  AND a.recipient_email ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'
  AND EXISTS (SELECT 1 FROM public.training_live_meetings l WHERE l.id = split_part(a.recipient_email, ':', 1)::uuid)
  AND EXISTS (SELECT 1 FROM public.training_participants p WHERE p.id = split_part(a.recipient_email, ':', 2)::uuid)
GROUP BY 1, 2
ON CONFLICT DO NOTHING;

-- Historique : envois programmés (live dans error_message = 'live:<uuid>')
INSERT INTO public.live_reminder_sends (live_meeting_id, participant_id, source, created_at)
SELECT substring(s.error_message from 'live:([0-9a-f-]{36})')::uuid, s.participant_id, 'scheduled_emails', min(s.sent_at)
FROM public.scheduled_emails s
WHERE s.email_type = 'live_reminder' AND s.status = 'sent' AND s.participant_id IS NOT NULL
  AND s.error_message ~ 'live:[0-9a-f-]{36}'
  AND EXISTS (SELECT 1 FROM public.training_live_meetings l WHERE l.id = substring(s.error_message from 'live:([0-9a-f-]{36})')::uuid)
  AND EXISTS (SELECT 1 FROM public.training_participants p WHERE p.id = s.participant_id)
GROUP BY 1, 2
ON CONFLICT DO NOTHING;
