DROP POLICY IF EXISTS "Authenticated users can view events" ON public.questionnaire_events;
CREATE POLICY "Formations staff view questionnaire events" ON public.questionnaire_events
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'formations'::text) OR public.is_staff_user());

DROP POLICY IF EXISTS book_analytics_events_auth_insert ON public.book_analytics_events;
CREATE POLICY book_analytics_events_auth_insert ON public.book_analytics_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.book_share_links l WHERE l.id = book_analytics_events.link_id AND l.revoked_at IS NULL));