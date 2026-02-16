-- Allow anonymous (public) read-only access to missions and activities
-- for the public mission summary page (/mission-info/:id)
-- UUIDs are unguessable, so knowledge of the ID serves as authorization

CREATE POLICY "Public can view missions by id"
  ON public.missions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can view mission activities"
  ON public.mission_activities
  FOR SELECT
  TO anon
  USING (true);
