
-- =============================================
-- M3 COMPLETION: Messaging + Coaching Booking
-- =============================================

-- Coaching booking by learners
CREATE TABLE public.coaching_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  requested_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',
  learner_notes TEXT,
  instructor_notes TEXT,
  meeting_url TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_coaching_bookings" ON public.coaching_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_manage_coaching_bookings" ON public.coaching_bookings FOR ALL TO anon USING (true) WITH CHECK (true);

-- M4: Coaching session summaries
CREATE TABLE public.coaching_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id),
  booking_id UUID REFERENCES public.coaching_bookings(id),
  summary_text TEXT NOT NULL,
  key_topics JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  generated_by TEXT DEFAULT 'ai',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_coaching_summaries" ON public.coaching_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
