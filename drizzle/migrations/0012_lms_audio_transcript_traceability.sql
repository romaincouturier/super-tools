ALTER TABLE public.media ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS idx_media_source_content_hash ON public.media (source_type, source_id, content_hash);
ALTER TABLE public.lms_lesson_blocks ADD COLUMN IF NOT EXISTS source_media_id uuid REFERENCES public.media(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lms_lesson_blocks_source_media ON public.lms_lesson_blocks (source_media_id) WHERE source_media_id IS NOT NULL;