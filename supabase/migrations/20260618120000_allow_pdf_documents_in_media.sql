-- Allow PDF documents to be attached to media entities (e.g. validation cards
-- on /contenu, where a LinkedIn carousel proof is uploaded as a PDF).

-- 1) Extend the media.file_type check to accept the new 'document' kind.
ALTER TABLE public.media
DROP CONSTRAINT IF EXISTS media_file_type_check;

ALTER TABLE public.media
ADD CONSTRAINT media_file_type_check
CHECK (file_type = ANY (ARRAY['image'::text, 'video'::text, 'video_link'::text, 'audio'::text, 'document'::text]));

-- 2) Allow PDF uploads in the unified 'media' bucket (images/videos only before).
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
WHERE id = 'media' AND NOT ('application/pdf' = ANY(allowed_mime_types));
