DROP POLICY IF EXISTS "balance_sheets_select" ON storage.objects;
DROP POLICY IF EXISTS "balance_sheets_insert" ON storage.objects;
DROP POLICY IF EXISTS "balance_sheets_delete" ON storage.objects;

CREATE POLICY "balance_sheets_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'balance-sheets'
    AND (
      public.is_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND public.has_module_access(auth.uid(), 'finances')
      )
    )
  );

CREATE POLICY "balance_sheets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'balance-sheets'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      public.is_admin(auth.uid())
      OR public.has_module_access(auth.uid(), 'finances')
    )
  );

CREATE POLICY "balance_sheets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'balance-sheets'
    AND (
      public.is_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND public.has_module_access(auth.uid(), 'finances')
      )
    )
  );