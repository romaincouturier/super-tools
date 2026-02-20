-- Training media gallery: photos and videos per training (formation)

CREATE TABLE IF NOT EXISTS public.training_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  mime_type text,
  file_size bigint,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.training_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training media"
  ON public.training_media FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert training media"
  ON public.training_media FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update training media"
  ON public.training_media FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete training media"
  ON public.training_media FOR DELETE TO authenticated
  USING (true);

CREATE INDEX idx_training_media_training_id ON public.training_media(training_id);

-- Storage bucket for training media (photos + videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-media',
  'training-media',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "training_media_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'training-media');

CREATE POLICY "training_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-media');

CREATE POLICY "training_media_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-media')
  WITH CHECK (bucket_id = 'training-media');

CREATE POLICY "training_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-media');
