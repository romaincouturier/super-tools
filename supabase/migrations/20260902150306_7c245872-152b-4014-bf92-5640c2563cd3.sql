DROP POLICY IF EXISTS staff_read_learner_notifications ON public.learner_notifications;
CREATE POLICY staff_read_learner_notifications
ON public.learner_notifications
FOR SELECT
TO authenticated
USING (public.is_staff_user() OR learner_email = public.get_learner_email());
DROP POLICY IF EXISTS authenticated_update_own_learner_notifications ON public.learner_notifications;
CREATE POLICY authenticated_update_own_learner_notifications
ON public.learner_notifications
FOR UPDATE
TO authenticated
USING (learner_email = public.get_learner_email())
WITH CHECK (learner_email = public.get_learner_email());