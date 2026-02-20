-- Unified media table: all photos, videos, and video links for all entities
-- Replaces: mission_media, event_media, training_media

CREATE TABLE IF NOT EXISTS public.media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video', 'video_link')),
  mime_type text,
  file_size bigint,
  position integer NOT NULL DEFAULT 0,
  source_type text NOT NULL CHECK (source_type IN ('mission', 'event', 'training', 'crm')),
  source_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view media"
  ON public.media FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert media"
  ON public.media FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update media"
  ON public.media FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete media"
  ON public.media FOR DELETE TO authenticated
  USING (true);

CREATE INDEX idx_media_source ON public.media(source_type, source_id);
CREATE INDEX idx_media_source_id ON public.media(source_id);
CREATE INDEX idx_media_created_at ON public.media(created_at DESC);

-- Single storage bucket for all new uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_bucket_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'media');

CREATE POLICY "media_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- Migrate existing data from mission_media
INSERT INTO public.media (id, file_url, file_name, file_type, mime_type, file_size, position, source_type, source_id, created_at, created_by)
SELECT id, file_url, file_name, file_type, mime_type, file_size, position, 'mission', mission_id, created_at, created_by
FROM public.mission_media;

-- Migrate existing data from event_media
INSERT INTO public.media (id, file_url, file_name, file_type, mime_type, file_size, position, source_type, source_id, created_at, created_by)
SELECT id, file_url, file_name, file_type, mime_type, file_size, position, 'event', event_id, created_at, created_by
FROM public.event_media;

-- Migrate existing data from training_media
INSERT INTO public.media (id, file_url, file_name, file_type, mime_type, file_size, position, source_type, source_id, created_at, created_by)
SELECT id, file_url, file_name, file_type, mime_type, file_size, position, 'training', training_id, created_at, created_by
FROM public.training_media;

-- Cascade delete triggers (since we use polymorphic source_id, no FK constraint)
CREATE OR REPLACE FUNCTION delete_media_for_source()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.media
  WHERE source_type = TG_ARGV[0]
    AND source_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delete_media_on_mission_delete
  BEFORE DELETE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION delete_media_for_source('mission');

CREATE TRIGGER trg_delete_media_on_event_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION delete_media_for_source('event');

CREATE TRIGGER trg_delete_media_on_training_delete
  BEFORE DELETE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION delete_media_for_source('training');

CREATE TRIGGER trg_delete_media_on_crm_card_delete
  BEFORE DELETE ON public.crm_cards
  FOR EACH ROW EXECUTE FUNCTION delete_media_for_source('crm');
