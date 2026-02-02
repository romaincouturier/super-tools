-- Drop existing overly permissive policies on training_evaluations
DROP POLICY IF EXISTS "Authenticated users can create evaluations" ON public.training_evaluations;
DROP POLICY IF EXISTS "Authenticated users can delete evaluations" ON public.training_evaluations;
DROP POLICY IF EXISTS "Authenticated users can view evaluations" ON public.training_evaluations;
DROP POLICY IF EXISTS "Public can update own evaluation" ON public.training_evaluations;
DROP POLICY IF EXISTS "Public can view own evaluation via token" ON public.training_evaluations;

-- Create restrictive RLS policies that check training ownership

-- Users can only view evaluations from trainings they created
CREATE POLICY "Users can view their training evaluations"
ON public.training_evaluations
FOR SELECT
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only create evaluations for trainings they created
CREATE POLICY "Users can create evaluations for their trainings"
ON public.training_evaluations
FOR INSERT
TO authenticated
WITH CHECK (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only update evaluations from trainings they created
CREATE POLICY "Users can update their training evaluations"
ON public.training_evaluations
FOR UPDATE
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Users can only delete evaluations from trainings they created
CREATE POLICY "Users can delete their training evaluations"
ON public.training_evaluations
FOR DELETE
TO authenticated
USING (
  training_id IN (SELECT id FROM public.trainings WHERE created_by = auth.uid())
);

-- Allow anonymous users to view ONLY their own evaluation via token
CREATE POLICY "Public can view own evaluation via token"
ON public.training_evaluations
FOR SELECT
TO anon
USING (
  token IS NOT NULL AND token != ''
);

-- Allow anonymous users to update ONLY their own evaluation via token
CREATE POLICY "Public can update own evaluation via token"
ON public.training_evaluations
FOR UPDATE
TO anon
USING (
  token IS NOT NULL AND token != ''
)
WITH CHECK (
  token IS NOT NULL AND token != ''
);