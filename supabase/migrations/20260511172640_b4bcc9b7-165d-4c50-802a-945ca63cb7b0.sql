DROP POLICY IF EXISTS "Authenticated users can insert mission documents" ON public.mission_documents;
DROP POLICY IF EXISTS "mission_documents_authenticated_insert" ON public.mission_documents;

CREATE POLICY "mission_documents_authenticated_insert"
ON public.mission_documents
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
);