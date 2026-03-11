CREATE POLICY "Authenticated users can update mission documents"
ON public.mission_documents
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');