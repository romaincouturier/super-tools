CREATE TABLE public.transcripts (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source         TEXT        NOT NULL CHECK (source IN ('google_drive', 'fireflies')),
  title          TEXT,
  external_id    TEXT        NOT NULL,         -- Drive file ID or Fireflies transcript ID
  assemblyai_id  TEXT,                         -- AssemblyAI job ID while processing
  raw_text       TEXT,
  summary        TEXT,
  tags           TEXT[]      DEFAULT '{}',
  duration_seconds INTEGER,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message  TEXT,
  metadata       JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transcripts"
  ON public.transcripts FOR SELECT TO authenticated USING (true);

CREATE TRIGGER transcripts_updated_at
  BEFORE UPDATE ON public.transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
