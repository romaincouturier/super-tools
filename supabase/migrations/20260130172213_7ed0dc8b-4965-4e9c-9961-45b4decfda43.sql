-- Allow authenticated users to delete evaluations
CREATE POLICY "Authenticated users can delete evaluations"
ON public.training_evaluations
FOR DELETE
USING (true);