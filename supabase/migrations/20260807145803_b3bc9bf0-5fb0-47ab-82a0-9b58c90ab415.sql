-- crm_card_transcripts: remove blanket authenticated read
DROP POLICY IF EXISTS "Authenticated users can view crm_card_transcripts" ON public.crm_card_transcripts;
CREATE POLICY "Staff can view crm_card_transcripts"
ON public.crm_card_transcripts FOR SELECT TO authenticated
USING (public.is_staff_user());

-- mission_page_comments: remove blanket authenticated read (public access goes through security definer RPC)
DROP POLICY IF EXISTS "Authenticated users can view mission page comments" ON public.mission_page_comments;
CREATE POLICY "Staff can view mission page comments"
ON public.mission_page_comments FOR SELECT TO authenticated
USING (public.is_staff_user());

-- mission_actions: restrict to staff
DROP POLICY IF EXISTS "Authenticated users can view mission actions" ON public.mission_actions;
DROP POLICY IF EXISTS "Authenticated users can insert mission actions" ON public.mission_actions;
DROP POLICY IF EXISTS "Authenticated users can update mission actions" ON public.mission_actions;
DROP POLICY IF EXISTS "Authenticated users can delete mission actions" ON public.mission_actions;
CREATE POLICY "Staff can manage mission actions"
ON public.mission_actions FOR ALL TO authenticated
USING (public.is_staff_user())
WITH CHECK (public.is_staff_user());

-- organizations: fix broken column comparison (om.org_id = om.id)
DROP POLICY IF EXISTS "org_select_members" ON public.organizations;
CREATE POLICY "org_select_members"
ON public.organizations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = organizations.id
      AND om.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

-- devis-pdfs storage: no anonymous read; signed URLs still work
DROP POLICY IF EXISTS "Public can read devis PDFs" ON storage.objects;
CREATE POLICY "Authenticated can read devis PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'devis-pdfs');