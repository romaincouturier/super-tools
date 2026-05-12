ALTER TABLE public.mission_documents
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS processing_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS processing_estimated_seconds integer,
  ADD COLUMN IF NOT EXISTS assemblyai_transcript_id text,
  ADD COLUMN IF NOT EXISTS transcript_page_id uuid REFERENCES public.mission_pages(id) ON DELETE SET NULL;

ALTER TABLE public.mission_documents
  DROP CONSTRAINT IF EXISTS mission_documents_processing_status_check;

ALTER TABLE public.mission_documents
  ADD CONSTRAINT mission_documents_processing_status_check
  CHECK (processing_status IN ('none', 'pending', 'processing', 'completed', 'failed'));

ALTER TABLE public.mission_documents
  DROP CONSTRAINT IF EXISTS mission_documents_processing_progress_check;

ALTER TABLE public.mission_documents
  ADD CONSTRAINT mission_documents_processing_progress_check
  CHECK (processing_progress >= 0 AND processing_progress <= 100);

CREATE INDEX IF NOT EXISTS idx_mission_documents_audio_processing
  ON public.mission_documents(processing_status, processing_updated_at)
  WHERE processing_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_mission_documents_transcript_page
  ON public.mission_documents(transcript_page_id)
  WHERE transcript_page_id IS NOT NULL;