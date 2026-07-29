-- Align admin-archives policies with other buckets (no TO authenticated restriction)
DROP POLICY IF EXISTS admin_archives_select ON storage.objects;
DROP POLICY IF EXISTS admin_archives_insert ON storage.objects;
DROP POLICY IF EXISTS admin_archives_update ON storage.objects;
DROP POLICY IF EXISTS admin_archives_delete ON storage.objects;

CREATE POLICY admin_archives_select ON storage.objects
  FOR SELECT USING (bucket_id = 'admin-archives');
CREATE POLICY admin_archives_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'admin-archives');
CREATE POLICY admin_archives_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'admin-archives') WITH CHECK (bucket_id = 'admin-archives');
CREATE POLICY admin_archives_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'admin-archives');

-- Same for admin_documents table
-- La table n'est créée que deux heures plus tard, par
-- 20260511210000_create_admin_archives.sql : au rejeu de l'historique elle
-- n'existe pas encore. Ce bloc est donc conditionné à sa présence, et cette
-- migration ne fait rien de plus que ce qu'elle faisait déjà en production.
DO $do$ BEGIN
IF to_regclass('public.admin_documents') IS NOT NULL THEN
  DROP POLICY IF EXISTS admin_documents_select ON public.admin_documents;
  DROP POLICY IF EXISTS admin_documents_insert ON public.admin_documents;
  DROP POLICY IF EXISTS admin_documents_update ON public.admin_documents;
  DROP POLICY IF EXISTS admin_documents_delete ON public.admin_documents;

  CREATE POLICY admin_documents_select ON public.admin_documents
    FOR SELECT USING (true);
  CREATE POLICY admin_documents_insert ON public.admin_documents
    FOR INSERT WITH CHECK (true);
  CREATE POLICY admin_documents_update ON public.admin_documents
    FOR UPDATE USING (true) WITH CHECK (true);
  CREATE POLICY admin_documents_delete ON public.admin_documents
    FOR DELETE USING (true);
END IF; END $do$;