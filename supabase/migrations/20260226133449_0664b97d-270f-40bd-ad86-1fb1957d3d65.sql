
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

DO $do$ BEGIN
  CREATE POLICY "Certificates are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Service role can upload certificates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificates');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Service role can update certificates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'certificates');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;