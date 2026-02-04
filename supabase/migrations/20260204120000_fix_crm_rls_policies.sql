-- Fix CRM RLS policies that might reference 'users' instead of 'auth.users'
-- Drop and recreate all CRM policies to ensure correct auth.users reference

-- Drop existing policies
DROP POLICY IF EXISTS "crm_columns_select" ON crm_columns;
DROP POLICY IF EXISTS "crm_columns_insert" ON crm_columns;
DROP POLICY IF EXISTS "crm_columns_update" ON crm_columns;
DROP POLICY IF EXISTS "crm_columns_delete" ON crm_columns;

DROP POLICY IF EXISTS "crm_tags_select" ON crm_tags;
DROP POLICY IF EXISTS "crm_tags_insert" ON crm_tags;
DROP POLICY IF EXISTS "crm_tags_update" ON crm_tags;
DROP POLICY IF EXISTS "crm_tags_delete" ON crm_tags;

DROP POLICY IF EXISTS "crm_cards_select" ON crm_cards;
DROP POLICY IF EXISTS "crm_cards_insert" ON crm_cards;
DROP POLICY IF EXISTS "crm_cards_update" ON crm_cards;
DROP POLICY IF EXISTS "crm_cards_delete" ON crm_cards;

DROP POLICY IF EXISTS "crm_card_tags_select" ON crm_card_tags;
DROP POLICY IF EXISTS "crm_card_tags_insert" ON crm_card_tags;
DROP POLICY IF EXISTS "crm_card_tags_delete" ON crm_card_tags;

DROP POLICY IF EXISTS "crm_attachments_select" ON crm_attachments;
DROP POLICY IF EXISTS "crm_attachments_insert" ON crm_attachments;
DROP POLICY IF EXISTS "crm_attachments_delete" ON crm_attachments;

DROP POLICY IF EXISTS "crm_comments_select" ON crm_comments;
DROP POLICY IF EXISTS "crm_comments_insert" ON crm_comments;
DROP POLICY IF EXISTS "crm_comments_update" ON crm_comments;

DROP POLICY IF EXISTS "crm_card_emails_select" ON crm_card_emails;
DROP POLICY IF EXISTS "crm_card_emails_insert" ON crm_card_emails;

DROP POLICY IF EXISTS "crm_activity_log_select" ON crm_activity_log;
DROP POLICY IF EXISTS "crm_activity_log_insert" ON crm_activity_log;

-- Helper function to check CRM access (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_crm_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'romain@supertilt.fr'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = _user_id AND module::text = 'crm'
  )
$$;

-- Columns policies
CREATE POLICY "crm_columns_select" ON crm_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_columns_insert" ON crm_columns FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_columns_update" ON crm_columns FOR UPDATE TO authenticated
  USING (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_columns_delete" ON crm_columns FOR DELETE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Tags policies
CREATE POLICY "crm_tags_select" ON crm_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_tags_insert" ON crm_tags FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_tags_update" ON crm_tags FOR UPDATE TO authenticated
  USING (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_tags_delete" ON crm_tags FOR DELETE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Cards policies
CREATE POLICY "crm_cards_select" ON crm_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_cards_insert" ON crm_cards FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_cards_update" ON crm_cards FOR UPDATE TO authenticated
  USING (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_cards_delete" ON crm_cards FOR DELETE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Card tags policies
CREATE POLICY "crm_card_tags_select" ON crm_card_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_card_tags_insert" ON crm_card_tags FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_card_tags_delete" ON crm_card_tags FOR DELETE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Attachments policies
CREATE POLICY "crm_attachments_select" ON crm_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_attachments_insert" ON crm_attachments FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_attachments_delete" ON crm_attachments FOR DELETE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Comments policies
CREATE POLICY "crm_comments_select" ON crm_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_comments_insert" ON crm_comments FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
CREATE POLICY "crm_comments_update" ON crm_comments FOR UPDATE TO authenticated
  USING (public.has_crm_access(auth.uid()));

-- Card emails policies
CREATE POLICY "crm_card_emails_select" ON crm_card_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_card_emails_insert" ON crm_card_emails FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));

-- Activity log policies
CREATE POLICY "crm_activity_log_select" ON crm_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_activity_log_insert" ON crm_activity_log FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_access(auth.uid()));
