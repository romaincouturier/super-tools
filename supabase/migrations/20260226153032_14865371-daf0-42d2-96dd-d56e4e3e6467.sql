
-- Allow public (anonymous) read access to missions for the summary page
CREATE POLICY "Public can view missions"
  ON public.missions FOR SELECT
  USING (true);

-- Allow public read access to mission_activities
CREATE POLICY "Public can view mission activities"
  ON public.mission_activities FOR SELECT
  USING (true);

-- Allow public read access to mission_documents
CREATE POLICY "Public can view mission documents"
  ON public.mission_documents FOR SELECT
  USING (true);
