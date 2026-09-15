ALTER TABLE public.lms_lessons
  ADD COLUMN IF NOT EXISTS source_transcript_id uuid NULL REFERENCES public.transcripts(id) ON DELETE SET NULL;

ALTER TABLE public.lms_lesson_blocks
  ADD COLUMN IF NOT EXISTS source_transcript_id uuid NULL REFERENCES public.transcripts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lms_lessons_source_transcript
  ON public.lms_lessons (source_transcript_id)
  WHERE source_transcript_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lms_lesson_blocks_source_transcript
  ON public.lms_lesson_blocks (source_transcript_id)
  WHERE source_transcript_id IS NOT NULL;