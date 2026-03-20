-- Add 'lms' to the media source_type constraint
ALTER TABLE public.media DROP CONSTRAINT media_source_type_check;
ALTER TABLE public.media ADD CONSTRAINT media_source_type_check
  CHECK (source_type = ANY (ARRAY['mission'::text, 'event'::text, 'training'::text, 'crm'::text, 'content'::text, 'lms'::text]));
