-- Drop existing overly permissive policies on training_participants
DROP POLICY IF EXISTS "Authenticated users can manage participants" ON public.training_participants;
DROP POLICY IF EXISTS "Authenticated users can view participants" ON public.training_participants;
DROP POLICY IF EXISTS "Public can update participant survey status" ON public.training_participants;

-- Create new restrictive RLS policies that check training ownership
-- Users can only view participants from trainings they created
CREATE POLICY "Users can view their own training participants"
ON public.training_participants
FOR SELECT
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only insert participants into trainings they created
CREATE POLICY "Users can insert participants into their trainings"
ON public.training_participants
FOR INSERT
TO authenticated
WITH CHECK (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only update participants in trainings they created
CREATE POLICY "Users can update their training participants"
ON public.training_participants
FOR UPDATE
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only delete participants from trainings they created
CREATE POLICY "Users can delete their training participants"
ON public.training_participants
FOR DELETE
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Allow public update for survey status via token (needed for questionnaire flow)
CREATE POLICY "Public can update participant survey status via token"
ON public.training_participants
FOR UPDATE
TO anon
USING (
  needs_survey_token IS NOT NULL
)
WITH CHECK (
  needs_survey_token IS NOT NULL
);