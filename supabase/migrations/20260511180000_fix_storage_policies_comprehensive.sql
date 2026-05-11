-- Comprehensive storage policy fix.
--
-- Problems identified:
-- 1. has_crm_access() was hardcoded to romain@supertilt.fr, blocking all
--    other users from uploading CRM attachments.
-- 2. crm-attachments INSERT/DELETE policies called has_crm_access(), which
--    propagated the hardcoded-email bug to storage.
-- 3. training-documents accumulated duplicate policy sets with different
--    names across 5 migrations; cleaned up in 20260511170000 but the
--    td_authenticated_* set from 20260204214125 may still be active.

-- ── 1. Fix has_crm_access to use is_admin OR has_module_access ──────────
CREATE OR REPLACE FUNCTION public.has_crm_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR public.has_module_access(_user_id, 'crm')
$$;

-- ── 2. Reset crm-attachments storage policies ────────────────────────────
DROP POLICY IF EXISTS crm_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS crm_attachments_delete ON storage.objects;
DROP POLICY IF EXISTS crm_attachments_select ON storage.objects;
DROP POLICY IF EXISTS "crm_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "crm_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "crm_attachments_delete" ON storage.objects;

CREATE POLICY crm_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm-attachments');

CREATE POLICY crm_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-attachments'
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'crm'))
  );

CREATE POLICY crm_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'crm'))
  );

-- ── 3. Clean up training-documents td_authenticated_* policies ───────────
-- Migration 20260204214125 created a set named td_authenticated_*
-- that was never dropped by subsequent fix migrations.
DROP POLICY IF EXISTS "td_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "td_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "td_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "td_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "td_public_select" ON storage.objects;
