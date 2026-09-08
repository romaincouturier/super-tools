CREATE TABLE IF NOT EXISTS public.event_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (event_id, transcript_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_transcripts TO authenticated;
GRANT ALL ON public.event_transcripts TO service_role;

ALTER TABLE public.event_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view event_transcripts" ON public.event_transcripts;
CREATE POLICY "Authenticated users can view event_transcripts"
  ON public.event_transcripts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert event_transcripts" ON public.event_transcripts;
CREATE POLICY "Authenticated users can insert event_transcripts"
  ON public.event_transcripts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete event_transcripts" ON public.event_transcripts;
CREATE POLICY "Authenticated users can delete event_transcripts"
  ON public.event_transcripts FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_event_transcripts_event ON public.event_transcripts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_transcripts_transcript ON public.event_transcripts(transcript_id);