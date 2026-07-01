ALTER TABLE public.watch_items DROP CONSTRAINT IF EXISTS watch_items_content_type_check;
ALTER TABLE public.watch_items ADD CONSTRAINT watch_items_content_type_check
  CHECK (content_type IN ('text','url','image','audio','video','document'));