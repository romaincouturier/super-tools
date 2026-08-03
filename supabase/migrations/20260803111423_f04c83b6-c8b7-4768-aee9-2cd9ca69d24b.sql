DROP POLICY IF EXISTS "Inbound emails manageable by admins" ON public.inbound_emails;
CREATE POLICY "Inbound emails manageable by admins" ON public.inbound_emails
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));