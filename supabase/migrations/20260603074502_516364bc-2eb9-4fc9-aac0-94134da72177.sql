CREATE TABLE public.crm_card_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.crm_cards(id) ON DELETE CASCADE,
  transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (card_id, transcript_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_card_transcripts TO authenticated;
GRANT ALL ON public.crm_card_transcripts TO service_role;

ALTER TABLE public.crm_card_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view crm_card_transcripts"
  ON public.crm_card_transcripts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert crm_card_transcripts"
  ON public.crm_card_transcripts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete crm_card_transcripts"
  ON public.crm_card_transcripts FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_crm_card_transcripts_card ON public.crm_card_transcripts(card_id);
CREATE INDEX idx_crm_card_transcripts_transcript ON public.crm_card_transcripts(transcript_id);