
-- 1. Scope book_analytics_events SELECT to link owner
DROP POLICY IF EXISTS "book_analytics_events_auth_select" ON public.book_analytics_events;
CREATE POLICY "book_analytics_events_owner_select"
ON public.book_analytics_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.book_share_links bsl
    WHERE bsl.id = book_analytics_events.link_id
      AND bsl.user_id = auth.uid()
  )
);

-- 2. Remove unconditional anon SELECT on mission_survey_questions, keep token-gated policy
DROP POLICY IF EXISTS "public_read_survey_questions" ON public.mission_survey_questions;

-- 3. Restrict session_start_notifications: drop public-role ALL policy (anon was unrestricted)
DROP POLICY IF EXISTS "Authenticated users can manage session start notifications" ON public.session_start_notifications;
