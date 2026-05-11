-- Définitive fix: training-documents storage policies.
-- Les migrations précédentes ciblaient les noms de policies (fragile).
-- Ici on cible directement le contenu (qual/with_check) qui référence
-- 'training-documents', puis on recrée un ensemble propre.

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '')        ILIKE '%training-documents%'
        OR COALESCE(with_check, '') ILIKE '%training-documents%'
        OR policyname              ILIKE '%training%document%'
        OR policyname              ILIKE '%training_document%'
        OR policyname              LIKE  'td_%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY training_documents_select
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'training-documents');

CREATE POLICY training_documents_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'training-documents')
  WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-documents');

-- Supprimer toute restriction MIME sur ce bucket
UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'training-documents';
