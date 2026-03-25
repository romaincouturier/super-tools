ALTER TABLE public.media
DROP CONSTRAINT IF EXISTS media_file_type_check;

ALTER TABLE public.media
ADD CONSTRAINT media_file_type_check
CHECK (file_type = ANY (ARRAY['image'::text, 'video'::text, 'video_link'::text, 'audio'::text]));