CREATE POLICY book_albums_module_all ON public.book_albums FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'book')) WITH CHECK (public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_productions_module_all ON public.book_productions FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'book')) WITH CHECK (public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_share_links_module_all ON public.book_share_links FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'book')) WITH CHECK (public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_analytics_events_module_select ON public.book_analytics_events FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_productions_storage_module_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-productions' AND public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_productions_storage_module_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-productions' AND public.has_module_access(auth.uid(), 'book'));
CREATE POLICY book_productions_storage_module_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-productions' AND public.has_module_access(auth.uid(), 'book'));