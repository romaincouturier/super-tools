-- Mission media gallery: photos and videos per mission

CREATE TABLE IF NOT EXISTS public.mission_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  mime_type text,
  file_size bigint,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.mission_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mission media"
  ON public.mission_media FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert mission media"
  ON public.mission_media FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mission media"
  ON public.mission_media FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete mission media"
  ON public.mission_media FOR DELETE TO authenticated
  USING (true);

CREATE INDEX idx_mission_media_mission_id ON public.mission_media(mission_id);

-- Storage bucket for mission media (photos + videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-media',
  'mission-media',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mission_media_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'mission-media');

CREATE POLICY "mission_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-media');

CREATE POLICY "mission_media_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-media')
  WITH CHECK (bucket_id = 'mission-media');

CREATE POLICY "mission_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mission-media');
