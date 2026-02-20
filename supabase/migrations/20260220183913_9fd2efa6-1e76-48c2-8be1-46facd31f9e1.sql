
-- Table pour tracker quelles sessions ont déjà été traitées (évite les doublons)
CREATE TABLE IF NOT EXISTS public.session_start_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_schedule_id uuid NOT NULL,
  period text NOT NULL CHECK (period IN ('AM', 'PM')),
  signature_sent_at timestamp with time zone,
  trainer_notified_at timestamp with time zone,
  participants_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_start_notifications_unique 
  ON public.session_start_notifications (training_schedule_id, period);

ALTER TABLE public.session_start_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage session start notifications"
  ON public.session_start_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);
