ALTER TABLE public.book_productions
  ADD COLUMN IF NOT EXISTS source_media_id uuid REFERENCES public.media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_book_productions_source_media_id
  ON public.book_productions(source_media_id);