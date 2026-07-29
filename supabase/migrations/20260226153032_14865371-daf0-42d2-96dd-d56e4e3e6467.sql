
-- Allow public (anonymous) read access to missions for the summary page
DO $do$ BEGIN
  CREATE POLICY "Public can view missions"
    ON public.missions FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Allow public read access to mission_activities
DO $do$ BEGIN
  CREATE POLICY "Public can view mission activities"
    ON public.mission_activities FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Allow public read access to mission_documents
DO $do$ BEGIN
  CREATE POLICY "Public can view mission documents"
    ON public.mission_documents FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;