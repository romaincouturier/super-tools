-- Add meeting_type to training_live_meetings to distinguish launch / live / closing events
ALTER TABLE public.training_live_meetings
  ADD COLUMN IF NOT EXISTS meeting_type TEXT NOT NULL DEFAULT 'live'
    CHECK (meeting_type IN ('launch', 'live', 'closing'));

-- Allow anon (learners without auth) to read live meetings via SECURITY DEFINER RPCs
-- and directly when needed (e.g. from the learner portal)
CREATE POLICY "anon_read_live_meetings"
  ON public.training_live_meetings FOR SELECT TO anon USING (true);
