-- 1. Create event-media storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-media', 'event-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for event-media bucket
DO $do$ BEGIN
  CREATE POLICY "Public can view event media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can upload event media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can update event media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can delete event media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- 3. Add 'events' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'events';