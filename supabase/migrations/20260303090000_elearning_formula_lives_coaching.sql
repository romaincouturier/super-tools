-- ===========================================
-- E-Learning: Formules, Lives, Coaching
-- ===========================================

-- 1. Colonne formula sur training_participants
ALTER TABLE public.training_participants
ADD COLUMN IF NOT EXISTS formula TEXT CHECK (formula IN ('solo', 'communaute', 'coachee'));

-- 2. Table des lives collectifs
CREATE TABLE public.training_live_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_live_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view live meetings"
ON public.training_live_meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage live meetings"
ON public.training_live_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_training_live_meetings_training ON public.training_live_meetings(training_id);
CREATE INDEX idx_training_live_meetings_scheduled ON public.training_live_meetings(scheduled_at);

CREATE TRIGGER update_training_live_meetings_updated_at
BEFORE UPDATE ON public.training_live_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Table des créneaux coaching individuel
CREATE TABLE public.training_coaching_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_coaching_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view coaching slots"
ON public.training_coaching_slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage coaching slots"
ON public.training_coaching_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_training_coaching_slots_training ON public.training_coaching_slots(training_id);
CREATE INDEX idx_training_coaching_slots_participant ON public.training_coaching_slots(participant_id);
CREATE INDEX idx_training_coaching_slots_scheduled ON public.training_coaching_slots(scheduled_at);

CREATE TRIGGER update_training_coaching_slots_updated_at
BEFORE UPDATE ON public.training_coaching_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Formules disponibles au niveau du catalogue
ALTER TABLE public.formation_configs
ADD COLUMN IF NOT EXISTS available_formulas TEXT[] DEFAULT '{}';

-- 5. Colonnes notes, status, cancellation_reason sur events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled'));

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 6. Colonnes event_type, cfp_deadline, event_url, cfp_url sur events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'internal' CHECK (event_type IN ('internal', 'external'));

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cfp_deadline DATE;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_url TEXT;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cfp_url TEXT;

-- 7. Étendre scheduled_emails avec les nouveaux types
ALTER TABLE public.scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_email_type_check;
ALTER TABLE public.scheduled_emails ADD CONSTRAINT scheduled_emails_email_type_check CHECK (
  email_type IN (
    'needs_survey', 'needs_survey_reminder', 'evaluation_reminder',
    'evaluation_reminder_1', 'evaluation_reminder_2',
    'training_documents', 'thank_you', 'calendar_invite',
    'elearning_access', 'certificate', 'accessibility_needs',
    'prerequis_warning', 'convention_email', 'convention_reminder',
    'trainer_summary', 'google_review', 'video_testimonial',
    'cold_evaluation', 'funder_reminder', 'participant_list_reminder',
    'live_reminder', 'coaching_reminder', 'coaching_booking_invite'
  )
);
