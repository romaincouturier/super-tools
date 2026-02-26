
ALTER TABLE public.media ADD COLUMN tags text[] DEFAULT '{}';
CREATE INDEX idx_media_tags ON public.media USING GIN(tags);
