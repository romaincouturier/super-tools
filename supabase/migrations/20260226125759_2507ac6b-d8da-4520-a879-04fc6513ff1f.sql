
-- Drop the restrictive SELECT policy for authenticated users
DROP POLICY IF EXISTS "Users can view their own training participants" ON public.training_participants;

-- Create a new SELECT policy that allows any authenticated user with formations access
CREATE POLICY "Users with formations access can view participants"
ON public.training_participants
FOR SELECT
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'formations')
);

-- Also fix UPDATE and DELETE to allow collaborators with formations access
DROP POLICY IF EXISTS "Users can update their training participants" ON public.training_participants;
CREATE POLICY "Users with formations access can update participants"
ON public.training_participants
FOR UPDATE
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'formations')
);

DROP POLICY IF EXISTS "Users can delete their training participants" ON public.training_participants;
CREATE POLICY "Users with formations access can delete participants"
ON public.training_participants
FOR DELETE
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'formations')
);

DROP POLICY IF EXISTS "Users can insert participants into their trainings" ON public.training_participants;
CREATE POLICY "Users with formations access can insert participants"
ON public.training_participants
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_module_access(auth.uid(), 'formations')
);
