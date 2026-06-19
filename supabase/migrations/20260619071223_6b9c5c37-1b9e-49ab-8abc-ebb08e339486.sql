-- inbound_emails: remove the open SELECT policy, keep admin-only access
DROP POLICY IF EXISTS "Inbound emails viewable by authenticated users" ON public.inbound_emails;

CREATE POLICY "Inbound emails viewable by admins"
ON public.inbound_emails
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- lms_deposit_feedback: restrict the permissive policy to staff with formations module access
DROP POLICY IF EXISTS auth_manage_deposit_feedback ON public.lms_deposit_feedback;

CREATE POLICY staff_manage_deposit_feedback
ON public.lms_deposit_feedback
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_module_access uma
    WHERE uma.user_id = auth.uid()
      AND uma.module = 'formations'
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_module_access uma
    WHERE uma.user_id = auth.uid()
      AND uma.module = 'formations'
  )
);