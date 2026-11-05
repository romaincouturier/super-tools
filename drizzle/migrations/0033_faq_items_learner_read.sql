GRANT SELECT ON public.faq_items TO authenticated;
CREATE POLICY "authenticated_read_active_faq" ON public.faq_items FOR SELECT TO authenticated USING (is_active = true);