ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS transcription_status text CHECK (transcription_status IN ('pending','processing','completed','failed')),
  ADD COLUMN IF NOT EXISTS assemblyai_transcript_id text,
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS transcription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_audio_seconds integer;

UPDATE public.media SET transcription_status = 'completed'
WHERE file_type = 'audio' AND transcript IS NOT NULL AND transcription_status IS NULL;

CREATE INDEX IF NOT EXISTS media_transcription_queue_idx
  ON public.media (transcription_updated_at NULLS FIRST)
  WHERE transcription_status IN ('pending','processing');