-- Fix RLS for crm_attachments and support_ticket_attachments tables.
-- These tables receive direct inserts from the authenticated frontend client.
-- Also fix storage bucket policies for crm-attachments and support-attachments.

-- ── 1. crm_attachments table ─────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crm_attachments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_attachments', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.crm_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_attachments_select
  ON public.crm_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY crm_attachments_insert
  ON public.crm_attachments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY crm_attachments_update
  ON public.crm_attachments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY crm_attachments_delete
  ON public.crm_attachments FOR DELETE
  TO authenticated USING (true);

-- ── 2. support_ticket_attachments table ──────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_ticket_attachments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_ticket_attachments', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_ticket_attachments_select
  ON public.support_ticket_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY support_ticket_attachments_insert
  ON public.support_ticket_attachments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY support_ticket_attachments_update
  ON public.support_ticket_attachments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY support_ticket_attachments_delete
  ON public.support_ticket_attachments FOR DELETE
  TO authenticated USING (true);

-- ── 3. crm-attachments storage bucket ────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '')        ILIKE '%crm-attachments%'
        OR COALESCE(with_check, '') ILIKE '%crm-attachments%'
        OR policyname              ILIKE '%crm%attachment%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY crm_attachments_storage_select
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'crm-attachments');

CREATE POLICY crm_attachments_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments');

CREATE POLICY crm_attachments_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'crm-attachments')
  WITH CHECK (bucket_id = 'crm-attachments');

CREATE POLICY crm_attachments_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-attachments');

-- ── 4. support-attachments storage bucket ────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '')        ILIKE '%support-attachments%'
        OR COALESCE(with_check, '') ILIKE '%support-attachments%'
        OR policyname              ILIKE '%support%attachment%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY support_attachments_storage_select
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'support-attachments');

CREATE POLICY support_attachments_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY support_attachments_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'support-attachments')
  WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY support_attachments_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments');
